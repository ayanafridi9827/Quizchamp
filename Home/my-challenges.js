import { auth, db } from './firebase-config.js';
import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// DOM Elements
const activeChallengesGrid = document.querySelector('.active-challenges');
const pastChallengesGrid = document.querySelector('.past-challenges');
const noChallengesMessage = document.querySelector('.no-challenges-message');
const loadingStates = document.querySelectorAll('.loading-state');

// Navigation Scroll Effect
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// Add animation delay to nav links
document.querySelectorAll('.nav-link').forEach((link, index) => {
    link.style.setProperty('--nav-index', index);
});

// Load User's Challenges
async function loadUserChallenges() {
    try {
        // Get user document
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            showNoChallengesMessage();
            return;
        }

        const userData = userDoc.data();
        const challengeHistory = userData.challengeHistory || [];

        if (challengeHistory.length === 0) {
            showNoChallengesMessage();
            return;
        }

        // Get all challenge IDs from history
        const challengeIds = challengeHistory.map(challenge => challenge.challengeId);

        // Get all challenge documents
        const challengesQuery = query(
            collection(db, 'contests'),
            where('__name__', 'in', challengeIds)
        );
        const challengesSnapshot = await getDocs(challengesQuery);

        // Create a map of challenge data
        const challengesMap = new Map();
        challengesSnapshot.forEach(doc => {
            challengesMap.set(doc.id, doc.data());
        });

        // Separate challenges into active and past
        const activeChallenges = [];
        const pastChallenges = [];

        challengeHistory.forEach(challenge => {
            const challengeData = challengesMap.get(challenge.challengeId);
            if (challengeData) {
                const challengeWithHistory = {
                    ...challengeData,
                    id: challenge.challengeId,
                    joinedAt: challenge.joinedAt,
                    status: challenge.status,
                    score: challenge.score || 0,
                    rewardEarned: challenge.rewardEarned || 0
                };

                if (challengeData.status === 'active') {
                    activeChallenges.push(challengeWithHistory);
                } else {
                    pastChallenges.push(challengeWithHistory);
                }
            }
        });

        // Display challenges
        displayChallenges(activeChallenges, activeChallengesGrid);
        displayChallenges(pastChallenges, pastChallengesGrid);

        // Hide loading states
        loadingStates.forEach(state => state.classList.add('hidden'));

    } catch (error) {
        console.error('Error loading challenges:', error);
        showError('Failed to load challenges. Please try again.');
    }
}

// Display Challenges
function displayChallenges(challenges, container) {
    if (challenges.length === 0) {
        container.innerHTML = `
            <div class="no-challenges-message">
                <i class="fas fa-info-circle"></i>
                <p>No challenges found in this category.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    const template = document.getElementById('challenge-card-template');

    challenges.forEach(challenge => {
        const card = template.content.cloneNode(true);
        
        // Set challenge title
        card.querySelector('.challenge-title').textContent = challenge.title;
        
        // Set status
        const statusElement = card.querySelector('.challenge-status');
        statusElement.textContent = challenge.status.toUpperCase();
        statusElement.classList.add(`status-${challenge.status}`);
        
        // Set prize
        card.querySelector('.prize-text').textContent = `Win ₹${challenge.prize}`;
        
        // Set participants
        const participantsCount = challenge.participants ? challenge.participants.length : 0;
        card.querySelector('.participants-text').textContent = 
            `${participantsCount} / ${challenge.maxSpots} Participants`;
        
        // Set date
        const joinedDate = new Date(challenge.joinedAt);
        card.querySelector('.date-text').textContent = 
            `Joined ${joinedDate.toLocaleDateString()}`;
        
        // Set score
        card.querySelector('.score-text').textContent = 
            `Score: ${challenge.score || 0}/${challenge.maxScore || 100}`;
        
        // Set progress
        const progressFill = card.querySelector('.progress-fill');
        const progressPercentage = card.querySelector('.progress-percentage');
        const progress = (challenge.score / challenge.maxScore) * 100 || 0;
        progressFill.style.width = `${progress}%`;
        progressPercentage.textContent = `${Math.round(progress)}%`;
        
        // Set continue button
        const continueBtn = card.querySelector('.continue-btn');
        continueBtn.href = `/challenge.html?id=${challenge.id}`;
        continueBtn.setAttribute('data-challenge-id', challenge.id);
        
        // Add click handler for analytics or additional functionality
        continueBtn.addEventListener('click', (e) => {
            // You can add analytics tracking here
            console.log(`Continuing challenge: ${challenge.id}`);
        });

        container.appendChild(card);
    });
}

// Show No Challenges Message
function showNoChallengesMessage() {
    loadingStates.forEach(state => state.classList.add('hidden'));
    noChallengesMessage.classList.remove('hidden');
}

// Show Error Message
function showError(message) {
    loadingStates.forEach(state => state.classList.add('hidden'));
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <p>${message}</p>
        <button onclick="window.location.reload()" class="retry-btn">
            <i class="fas fa-sync-alt"></i> Retry
        </button>
    `;
    document.querySelector('.challenges-container').appendChild(errorMessage);
}

// Handle Authentication State Changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, load their challenges
        loadUserChallenges();
    } else {
        // User is not signed in, redirect to login page
        window.location.href = '/auth/login.html?redirect=my-challenges';
    }
});

// Event Listeners
document.addEventListener('click', async (e) => {
    if (e.target.closest('.join-btn')) {
        const challengeId = e.target.closest('.join-btn').dataset.id;
        await joinChallenge(challengeId);
    } else if (e.target.closest('.continue-btn')) {
        const challengeId = e.target.closest('.continue-btn').dataset.id;
        window.location.href = `quiz/quiz.html?id=${challengeId}`;
    } else if (e.target.closest('.view-results-btn')) {
        const challengeId = e.target.closest('.view-results-btn').dataset.id;
        window.location.href = `results.html?id=${challengeId}`;
    }
}); 