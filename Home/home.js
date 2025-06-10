// Import Firebase services and utility functions
import { auth, db } from './firebase-config.js';
import { joinChallenge, hasJoinedChallenge } from './challenge-utils.js';
import { 
    collection, 
    query, 
    orderBy, 
    where,
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const allContestsGrid = document.querySelector('.all-contests-grid');
const loadingState = document.querySelector('.loading-state');
const errorState = document.querySelector('.error-state');
const retryBtn = document.querySelector('.retry-btn');

// Load All Contests from Firebase
async function loadAllContests() {
    try {
        // Show loading state
        loadingState?.classList.remove('hidden');
        errorState?.classList.add('hidden');
        allContestsGrid.innerHTML = '';

        // Create query for both active and upcoming contests
        const contestsQuery = query(
            collection(db, 'contests'),
            where('status', 'in', ['Active', 'Upcoming'])
        );

        // Set up real-time listener
        return onSnapshot(contestsQuery, 
            (snapshot) => {
                const contests = [];
                snapshot.forEach(doc => {
                    contests.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                // Sort contests by startTime
                contests.sort((a, b) => a.startTime - b.startTime);

                // Separate contests into active and upcoming
                const activeContests = contests.filter(contest => contest.status === 'Active');
                const upcomingContests = contests.filter(contest => contest.status === 'Upcoming');

                // Clear the grid
                allContestsGrid.innerHTML = '';

                // Create and append active contests section
                if (activeContests.length > 0) {
                    const activeSection = document.createElement('div');
                    activeSection.className = 'contest-section';
                    activeSection.innerHTML = `
                        <h2 class="section-title">
                            <i class="fas fa-fire"></i>
                            Active Contests
                        </h2>
                        <div class="contest-grid active-contests"></div>
                    `;
                    allContestsGrid.appendChild(activeSection);

                    const activeGrid = activeSection.querySelector('.active-contests');
                    activeContests.forEach(contest => {
                        const card = createContestCard(contest);
                        activeGrid.appendChild(card);
                    });
                }

                // Create and append upcoming contests section
                if (upcomingContests.length > 0) {
                    const upcomingSection = document.createElement('div');
                    upcomingSection.className = 'contest-section';
                    upcomingSection.innerHTML = `
                        <h2 class="section-title">
                            <i class="fas fa-calendar-alt"></i>
                            Upcoming Contests
                        </h2>
                        <div class="contest-grid upcoming-contests"></div>
                    `;
                    allContestsGrid.appendChild(upcomingSection);

                    const upcomingGrid = upcomingSection.querySelector('.upcoming-contests');
                    upcomingContests.forEach(contest => {
                        const card = createContestCard(contest);
                        upcomingGrid.appendChild(card);
                    });
                }

                // Show message if no contests are available
                if (contests.length === 0) {
                    allContestsGrid.innerHTML = `
                        <div class="no-contests-message">
                            <i class="fas fa-calendar-times"></i>
                            <h3>No Contests Available</h3>
                            <p>Check back later for new contests!</p>
                        </div>
                    `;
                }

                loadingState?.classList.add('hidden');
            },
            (error) => {
                console.error('Error loading contests:', error);
                loadingState?.classList.add('hidden');
                errorState?.classList.remove('hidden');
                allContestsGrid.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <h3>Error Loading Contests</h3>
                        <p>Please try again later.</p>
                        <button onclick="window.location.reload()" class="retry-btn">
                            <i class="fas fa-sync-alt"></i> Retry
                        </button>
                    </div>
                `;
            }
        );
    } catch (error) {
        console.error('Error loading contests:', error);
        loadingState?.classList.add('hidden');
        errorState?.classList.remove('hidden');
        allContestsGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error Loading Contests</h3>
                <p>Please try again later.</p>
                <button onclick="window.location.reload()" class="retry-btn">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
}

// Create Contest Card
function createContestCard(contest) {
    const template = document.getElementById('contest-card-template');
    const card = template.content.cloneNode(true);
    
    // Set contest data
    card.querySelector('.contest-title').textContent = contest.title;
    
    // Set category icon
    const categoryIcon = card.querySelector('.category-icon i');
    categoryIcon.className = 'fas ' + getSubjectIcon(contest.subject);

    // Set prize section
    const prizeText = card.querySelector('.prize-text');
    prizeText.textContent = `Win ₹${contest.prize}`;

    // Set entry fee
    const entryFeeText = card.querySelector('.entry-fee-text');
    entryFeeText.textContent = contest.entryFee === 0 ? 'Free Entry' : `₹${contest.entryFee}`;

    // Set spots data
    const cardElement = card.querySelector('.contest-card');
    cardElement.dataset.max = contest.maxSpots || '50';
    cardElement.dataset.filled = contest.participants ? contest.participants.length : '0';
    
    // Set spots filled
    const spotsText = card.querySelector('.spots-filled');
    spotsText.textContent = `${contest.participants ? contest.participants.length : 0} / ${contest.maxSpots} Spots`;
    
    // Set progress bar
    const progressFill = card.querySelector('.progress-fill');
    const progressText = card.querySelector('.progress-text');
    const progressPercentage = card.querySelector('.progress-percentage');
    
    const spotsPercentage = ((contest.participants ? contest.participants.length : 0) / contest.maxSpots) * 100;
    progressFill.style.width = `${spotsPercentage}%`;
    progressText.textContent = 'Spots Filled';
    progressPercentage.textContent = `${Math.round(spotsPercentage)}%`;

    // Set join button
    const joinButton = card.querySelector('.join-btn');
    const joinText = card.querySelector('.join-text');
    joinText.textContent = contest.entryFee === 0 ? 'Join Free' : `Join ₹${contest.entryFee}`;

    // Add join button click handler
    joinButton.addEventListener('click', () => handleJoinContest(contest, joinButton));

    return card;
}

// Handle Join Contest
async function handleJoinContest(contest, button) {
    try {
        const card = button.closest('.contest-card');
        const maxSpots = parseInt(card.dataset.max) || 50;
        const currentSpots = parseInt(card.dataset.filled) || 0;
        
        // Check if contest is full
        if (currentSpots >= maxSpots) {
            showToast('Sorry, this contest is full!', 'error');
            return;
        }

        // Check if user is authenticated
        if (!auth.currentUser) {
            // Redirect to login page with challenge ID
            window.location.href = `/auth/login.html?challengeId=${contest.id}`;
            return;
        }

        // Check if user has already joined
        const hasJoined = await hasJoinedChallenge(contest.id);
        if (hasJoined) {
            showToast('You have already joined this contest!', 'error');
            return;
        }

        // Attempt to join the contest
        const result = await joinChallenge(contest.id);
        
        if (result.success) {
            // Update UI after successful join
            card.dataset.filled = currentSpots + 1;
            button.disabled = true;
            button.classList.add('joined');
            button.innerHTML = `
                <span class="join-text">✅ Joined</span>
                <i class="fas fa-check"></i>
                <div class="btn-glow"></div>
            `;
            
            // Update progress
            updateContestProgress(card);
            
            showToast(result.message, 'success');
        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('Error joining contest:', error);
        showToast('An error occurred. Please try again.', 'error');
    }
}

// Update Contest Progress
function updateContestProgress(card) {
    const progressFill = card.querySelector('.progress-fill');
    const spotsText = card.querySelector('.spots-filled');
    const progressPercentage = card.querySelector('.progress-percentage');
    
    const maxSpots = parseInt(card.dataset.max) || 50;
    const spotsFilled = parseInt(card.dataset.filled) || 0;
    const percentage = (spotsFilled / maxSpots) * 100;
    
    progressFill.style.width = `${percentage}%`;
    spotsText.textContent = `${spotsFilled} / ${maxSpots} Spots`;
    progressPercentage.textContent = `${Math.round(percentage)}%`;
}

// Show Toast Message
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Get Subject Icon
function getSubjectIcon(subject) {
    const iconMap = {
        'Mathematics': 'fa-calculator',
        'Science': 'fa-flask',
        'Physics': 'fa-atom',
        'Chemistry': 'fa-vial',
        'Biology': 'fa-dna',
        'English': 'fa-book',
        'History': 'fa-landmark',
        'Geography': 'fa-globe',
        'General Knowledge': 'fa-brain',
        'Computer Science': 'fa-laptop-code',
        'Economics': 'fa-chart-line',
        'Literature': 'fa-book-open',
        'Current Affairs': 'fa-newspaper',
        'Logical Reasoning': 'fa-puzzle-piece',
        'Verbal Ability': 'fa-comments'
    };
    return iconMap[subject] || 'fa-trophy';
}

// Retry loading contests
retryBtn.addEventListener('click', loadAllContests);

// Initial load
loadAllContests();
