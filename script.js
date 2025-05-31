document.getElementById('getStarted').addEventListener('click', function() {
    document.querySelector('.quiz-container').classList.remove('hidden');
    // Initialize quiz questions here
    // This would be expanded with actual quiz logic
});

// Sample quiz data structure
const questions = [
    {
        question: "What is the capital of France?",
        options: ["London", "Paris", "Berlin", "Madrid"],
        answer: 1
    }
    // Add more questions here
];

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Add animation class to elements when they come into view
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
        }
    });
}, observerOptions);

// Observe all sections
document.querySelectorAll('section').forEach(section => {
    observer.observe(section);
});

// Add hover effect to feature cards
document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
    });
});

// Initialize AOS
AOS.init({
    duration: 800,
    once: true
});

// DOM Elements
const themeToggle = document.getElementById('themeToggle');
const walletBtn = document.getElementById('walletBtn');
const walletModal = document.getElementById('walletModal');
const closeBtn = document.querySelector('.close');
const contestGrid = document.getElementById('contestGrid');
const filterBtns = document.querySelectorAll('.filter-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const preloader = document.querySelector('.preloader');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const mobileMenu = document.querySelector('.mobile-menu');
const closeMenuBtn = document.querySelector('.close-menu');
const mobileMenuLinks = document.querySelectorAll('.mobile-menu nav a');

// Theme Toggle
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    const icon = themeToggle.querySelector('i');
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = themeToggle.querySelector('i');
    icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Sample contest data
const contests = [
    {
        id: 1,
        title: 'Science Clash - Class 9',
        subject: 'Science',
        class: '9th',
        prize: '₹500',
        status: 'Live',
        icon: '🔬',
        category: 'science'
    },
    {
        id: 2,
        title: 'Math Masters - Class 10',
        subject: 'Mathematics',
        class: '10th',
        prize: '₹750',
        status: 'Upcoming',
        icon: '📐',
        category: 'math'
    },
    {
        id: 3,
        title: 'GK Challenge',
        subject: 'General Knowledge',
        class: 'All Classes',
        prize: '₹1000',
        status: 'Live',
        icon: '🌍',
        category: 'gk'
    },
    {
        id: 4,
        title: 'History Hunt',
        subject: 'History',
        class: '8th-10th',
        prize: '₹600',
        status: 'Live',
        icon: '📚',
        category: 'gk'
    }
];

// Sample leaderboard data
const leaderboardData = {
    daily: [
        { rank: 1, name: 'John Doe', points: 2500, wins: 5 },
        { rank: 2, name: 'Jane Smith', points: 2200, wins: 4 },
        { rank: 3, name: 'Mike Johnson', points: 2000, wins: 3 }
    ],
    weekly: [
        { rank: 1, name: 'Sarah Wilson', points: 15000, wins: 25 },
        { rank: 2, name: 'David Brown', points: 12000, wins: 20 },
        { rank: 3, name: 'Emma Davis', points: 10000, wins: 18 }
    ],
    monthly: [
        { rank: 1, name: 'Alex Turner', points: 50000, wins: 80 },
        { rank: 2, name: 'Lisa Anderson', points: 45000, wins: 75 },
        { rank: 3, name: 'Tom Wilson', points: 40000, wins: 70 }
    ]
};

// Sample testimonial data
const testimonials = [
    {
        name: 'John Doe',
        role: 'Student',
        image: 'https://randomuser.me/api/portraits/men/1.jpg',
        text: 'QuizChamp has helped me improve my knowledge while earning real money. The contests are challenging and fun!'
    },
    {
        name: 'Jane Smith',
        role: 'Teacher',
        image: 'https://randomuser.me/api/portraits/women/1.jpg',
        text: 'As a teacher, I recommend QuizChamp to my students. It\'s a great way to learn and earn simultaneously.'
    },
    {
        name: 'Mike Johnson',
        role: 'Professional',
        image: 'https://randomuser.me/api/portraits/men/2.jpg',
        text: 'The platform is user-friendly and the rewards are instant. I\'ve won several contests and the experience has been amazing!'
    }
];

// Create contest card
function createContestCard(contest) {
    const card = document.createElement('div');
    card.className = 'contest-card';
    card.setAttribute('data-category', contest.category);
    
    card.innerHTML = `
        <h3>${contest.title}</h3>
        <div class="contest-details">
            <p><i class="fas fa-graduation-cap"></i> Class: ${contest.class}</p>
            <p><i class="fas fa-book"></i> ${contest.subject}</p>
            <p><i class="fas fa-rupee-sign"></i> Prize: ${contest.prize}</p>
            <p><i class="fas fa-clock"></i> ${contest.status}</p>
        </div>
        <button class="btn btn-primary join-btn">Join Contest</button>
    `;
    
    return card;
}

// Filter contests
function filterContests(category) {
    const cards = document.querySelectorAll('.contest-card');
    cards.forEach(card => {
        if (category === 'all' || card.getAttribute('data-category') === category) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Create leaderboard row
function createLeaderboardRow(player) {
    return `
        <div class="leaderboard-row">
            <span class="rank">#${player.rank}</span>
            <span class="name">${player.name}</span>
            <span class="points">${player.points} pts</span>
            <span class="wins">${player.wins} wins</span>
        </div>
    `;
}

// Update leaderboard
function updateLeaderboard(period) {
    const content = document.querySelector('.leaderboard-content');
    if (!content) return;
    
    const data = leaderboardData[period];
    content.innerHTML = data.map(player => createLeaderboardRow(player)).join('');
}

// Initialize testimonial slider
function initTestimonialSlider() {
    const slider = document.querySelector('.testimonial-slider');
    if (!slider) return;

    const swiper = new Swiper('.testimonial-slider', {
        slidesPerView: 1,
        spaceBetween: 30,
        loop: true,
        autoplay: {
            delay: 5000,
            disableOnInteraction: false,
        },
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        breakpoints: {
            768: {
                slidesPerView: 2,
            },
            1024: {
                slidesPerView: 3,
            },
        },
    });

    // Add testimonial slides
    const wrapper = document.querySelector('.swiper-wrapper');
    if (!wrapper) return;

    testimonials.forEach(testimonial => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `
            <div class="testimonial-card">
                <img src="${testimonial.image}" alt="${testimonial.name}" class="testimonial-image">
                <p class="testimonial-text">${testimonial.text}</p>
                <h4 class="testimonial-name">${testimonial.name}</h4>
                <p class="testimonial-role">${testimonial.role}</p>
            </div>
        `;
        wrapper.appendChild(slide);
    });
}

// Load contests
function loadContests() {
    if (!contestGrid) return;
    
    contestGrid.innerHTML = '';
    contests.forEach(contest => {
        const card = createContestCard(contest);
        contestGrid.appendChild(card);
    });
}

// Initialize page
function initializePage() {
    // Hide preloader
    if (preloader) {
        setTimeout(() => {
            preloader.style.opacity = '0';
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 500);
        }, 1000);
    }

    // Load initial content
    loadContests();
    updateLeaderboard('daily');
    initTestimonialSlider();
}

// Event Listeners
if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

if (walletBtn) {
    walletBtn.addEventListener('click', () => {
        if (walletModal) {
            walletModal.style.display = 'block';
        }
    });
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        if (walletModal) {
            walletModal.style.display = 'none';
        }
    });
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (walletModal && e.target === walletModal) {
        walletModal.style.display = 'none';
    }
});

// Filter buttons
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterContests(btn.getAttribute('data-filter'));
    });
});

// Tab buttons
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateLeaderboard(btn.getAttribute('data-tab'));
    });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Join Contest Button Click Handler
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('join-btn')) {
        // Add your contest joining logic here
        alert('Contest joining functionality will be implemented soon!');
    }
});

// Newsletter Form Handler
const newsletterForm = document.querySelector('.newsletter-form');
if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = newsletterForm.querySelector('input[type="email"]').value;
        // Add your newsletter subscription logic here
        alert('Thank you for subscribing to our newsletter!');
        newsletterForm.reset();
    });
}

// Mobile Menu Toggle
function toggleMobileMenu() {
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
}

mobileMenuBtn.addEventListener('click', toggleMobileMenu);
closeMenuBtn.addEventListener('click', toggleMobileMenu);

// Close mobile menu when clicking on a link
mobileMenuLinks.forEach(link => {
    link.addEventListener('click', () => {
        toggleMobileMenu();
    });
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Newsletter Form
const newsletterFormMobile = document.querySelector('.newsletter-form');
if (newsletterFormMobile) {
    newsletterFormMobile.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = this.querySelector('input[type="email"]').value;
        if (email) {
            // Here you would typically send this to your backend
            alert('Thank you for subscribing!');
            this.reset();
        }
    });
}

// Add animation on scroll
function animateOnScroll() {
    const elements = document.querySelectorAll('.step, .feature-card');
    elements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const elementBottom = element.getBoundingClientRect().bottom;
        
        if (elementTop < window.innerHeight && elementBottom > 0) {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }
    });
}

// Initialize animations
document.addEventListener('DOMContentLoaded', () => {
    // Set initial state for animated elements
    const elements = document.querySelectorAll('.step, .feature-card');
    elements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });

    // Add scroll event listener
    window.addEventListener('scroll', animateOnScroll);
    // Trigger once on load
    animateOnScroll();
});

// Handle window resize
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (window.innerWidth > 768) {
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    }, 250);
});

// Initialize page when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}