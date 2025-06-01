import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase configuration (Replace with your actual config)
const firebaseConfig = {
    apiKey: "AIzaSyBgCHdqzcsiB9VBTsv4O1fU2R88GVoOOyA",
    authDomain: "quizarena-c222d.firebaseapp.com",
    projectId: "quizarena-c222d",
    storageBucket: "quizarena-c222d.firebasestorage.app",
    messagingSenderId: "892135666693",
    appId: "1:892135666693:web:4f8bf849019603a937586c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const myChallengesContainer = document.getElementById('myChallengesContainer');
const challengeCardTemplate = document.getElementById('challenge-card-template');
const loadingState = document.querySelector('.loading-state');
const noChallengesMessage = document.querySelector('.no-challenges-message');
const errorMessageElement = document.querySelector('.error-message');

// Utility functions

function showLoading() {
    if (loadingState) loadingState.classList.add('active');
    if (noChallengesMessage) noChallengesMessage.classList.remove('active');
    if (errorMessageElement) errorMessageElement.classList.remove('active');
    if (myChallengesContainer) myChallengesContainer.innerHTML = ''; // Clear previous content
}

function hideLoading() {
    if (loadingState) loadingState.classList.remove('active');
}

function showNoChallenges() {
    hideLoading();
    if (noChallengesMessage) noChallengesMessage.classList.add('active');
    if (errorMessageElement) errorMessageElement.classList.remove('active');
     if (myChallengesContainer) myChallengesContainer.innerHTML = ''; // Clear previous content
}

function showErrorMessage(message = 'An unknown error occurred.') {
    hideLoading();
    if (errorMessageElement) {
        errorMessageElement.querySelector('p').textContent = message;
        errorMessageElement.classList.add('active');
    }
    if (noChallengesMessage) noChallengesMessage.classList.remove('active');
    if (myChallengesContainer) myChallengesContainer.innerHTML = ''; // Clear previous content
}

// Format date (assuming joinedAt is a Firebase Timestamp)
function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') {
        return 'N/A';
    }
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Create challenge card element
function createChallengeCardElement(challenge) {
    if (!challengeCardTemplate) {
        console.error('Challenge card template not found!');
        return null;
    }

    const cardClone = challengeCardTemplate.content.cloneNode(true);
    const card = cardClone.firstElementChild; // Get the main div

    // Set data attributes
    card.dataset.challengeId = challenge.challengeId; // Use challengeId for the card element

    // Populate card details
    const titleElement = card.querySelector('.challenge-title');
    if (titleElement) titleElement.textContent = challenge.title || 'Untitled Challenge';

    const dateElement = card.querySelector('.date-text');
    if (dateElement) dateElement.textContent = formatDate(challenge.joinedAt); // Format timestamp

    const entryPrizeElement = card.querySelector('.entry-prize-text');
    if (entryPrizeElement) {
        entryPrizeElement.textContent = `Entry: ${challenge.entryFee || 0} | Prize: ${challenge.prize || 0}`;
    }

    const participantsElement = card.querySelector('.participants-text');
     if (participantsElement) participantsElement.textContent = `${challenge.participants || 0} participants`;

    const statusBadgeElement = card.querySelector('.status-badge');
    if (statusBadgeElement) {
        const status = challenge.status ? challenge.status.toLowerCase() : 'unknown';
        statusBadgeElement.textContent = status;
        statusBadgeElement.className = 'status-badge'; // Reset classes
        statusBadgeElement.classList.add(`status-${status}`);
    }

    const continueButton = card.querySelector('.continue-btn');
    if (continueButton) {
        // Set the href and data attribute for the button
        continueButton.href = `quiz/quiz.html?contestId=${challenge.challengeId}`;
        continueButton.dataset.challengeId = challenge.challengeId;

        // Disable button based on status
        if (challenge.status === 'completed' || challenge.status === 'eliminated' || challenge.status === 'unavailable') {
            continueButton.disabled = true;
            continueButton.classList.add('opacity-50', 'cursor-not-allowed'); // Add disabled styling
            continueButton.textContent = challenge.status === 'completed' ? 'Completed' : challenge.status === 'eliminated' ? 'Eliminated' : 'View Details';
        } else {
             continueButton.disabled = false;
             continueButton.classList.remove('opacity-50', 'cursor-not-allowed');
              continueButton.textContent = 'Continue Challenge';
        }
    }

    return card;
}

// Fetch user's joined challenges
async function fetchAndDisplayUserChallenges(userId) {
    showLoading();
    console.log('Fetching challenges for user:', userId);

    try {
        // First, get all contests where the user is a participant
        const contestsRef = collection(db, 'contests');
        const q = query(
            contestsRef,
            where('participants', 'array-contains', userId)
        );
        
        const contestsSnapshot = await getDocs(q);
        const contestIds = contestsSnapshot.docs.map(doc => doc.id);
        
        if (contestIds.length === 0) {
            console.log('No contests found for user');
            showNoChallenges();
            return;
        }

        // Then, get the user's challenge history
        const userRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userRef);

        if (!userDocSnap.exists()) {
            console.log('User document not found.');
            showNoChallenges();
            return;
        }

        const userData = userDocSnap.data();
        const challengeHistory = Array.isArray(userData.challengeHistory) ? userData.challengeHistory : [];

        // Filter challenge history to only include contests the user is participating in
        const filteredHistory = challengeHistory.filter(history => 
            contestIds.includes(history.challengeId)
        );

        if (filteredHistory.length === 0) {
            console.log('No challenge history found for user');
            showNoChallenges();
        return;
    }
    
        // Helper function to safely get timestamp value
        function getTimestampValue(timestamp) {
            if (!timestamp) return 0;
            
            // If it's a Firestore Timestamp
            if (typeof timestamp.toMillis === 'function') {
                return timestamp.toMillis();
            }
            
            // If it's a regular Date object
            if (timestamp instanceof Date) {
                return timestamp.getTime();
            }
            
            // If it's a number (milliseconds)
            if (typeof timestamp === 'number') {
                return timestamp;
            }
            
            // If it's a string that can be converted to a date
            if (typeof timestamp === 'string') {
                const date = new Date(timestamp);
                return isNaN(date.getTime()) ? 0 : date.getTime();
            }
            
            return 0;
        }

        // Sort challenges by joinedAt date descending
        filteredHistory.sort((a, b) => {
            const dateA = getTimestampValue(a.joinedAt);
            const dateB = getTimestampValue(b.joinedAt);
            return dateB - dateA; // Descending order
        });

        const challengesToDisplay = [];

        // Fetch details for each challenge from the contests collection
        for (const historyEntry of filteredHistory) {
            if (!historyEntry.challengeId) {
                console.warn('Skipping history entry with missing challengeId:', historyEntry);
                continue;
            }

            try {
                const contestRef = doc(db, 'contests', historyEntry.challengeId);
                const contestDocSnap = await getDoc(contestRef);

                if (contestDocSnap.exists()) {
                    const contestData = contestDocSnap.data();
                    
                    // Only add if the user is still a participant
                    if (contestData.participants && contestData.participants.includes(userId)) {
                        challengesToDisplay.push({
                            ...historyEntry,
                            title: contestData.title || 'Untitled Contest',
                            participants: contestData.participants?.length || 0,
                            maxParticipants: contestData.maxSpots || 0,
                            status: historyEntry.status || 'active'
                        });
                    }
                } else {
                    console.warn('Contest document not found for ID:', historyEntry.challengeId);
                }
            } catch (error) {
                console.error('Error fetching contest document for ID:', historyEntry.challengeId, error);
            }
        }

        // Clear container before displaying
        if (myChallengesContainer) myChallengesContainer.innerHTML = '';

        // Display challenges
        if (challengesToDisplay.length > 0) {
            challengesToDisplay.forEach(challenge => {
                const cardElement = createChallengeCardElement(challenge);
                if (cardElement && myChallengesContainer) {
                    myChallengesContainer.appendChild(cardElement);
                }
            });
        } else {
            showNoChallenges();
        }

        hideLoading();

    } catch (error) {
        console.error('Error fetching user challenges:', error);
        showErrorMessage('Failed to load challenges.');
    }
}

// Listen for authentication state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, fetch and display challenges
        fetchAndDisplayUserChallenges(user.uid);
    } else {
        // User is signed out, redirect to login page
        console.log('User is signed out. Redirecting to login.');
        // window.location.href = 'login.html'; // Uncomment when you have a login page
        showErrorMessage('Please log in to view your challenges.');
        hideLoading(); // Hide loading if not redirecting immediately
    }
});

// Add event listener for Continue Challenge button clicks (using event delegation)
document.addEventListener('click', function(event) {
    const continueButton = event.target.closest('.continue-btn');
    if (continueButton && !continueButton.disabled) {
        // The link's href is already set in createChallengeCardElement
        // We can prevent default and navigate programmatically if needed, 
        // but letting the link handle it is usually fine.
        console.log('Continue button clicked for challenge:', continueButton.dataset.challengeId);
        // Navigation is handled by the <a> tag's href
    }
});
