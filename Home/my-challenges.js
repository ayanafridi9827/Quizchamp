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
        entryPrizeElement.textContent = `Entry: ${challenge.entryFee || 0} | Prize: ₹${challenge.prize || 0}`;
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

    // Add winner/pending status message based on challenge status
    const statusMessagesContainer = card.querySelector('.status-messages');
    if (statusMessagesContainer) {
        statusMessagesContainer.innerHTML = ''; // Clear any default content

        if (challenge.status === 'completed') {
            statusMessagesContainer.innerHTML = `
                <div class="pending-winner-status text-sm mb-4">
                    <div class="flex items-center text-yellow-700">
                        <i class="fas fa-clock mr-2"></i>
                        <span class="pending-text">Winner pending. Will be decided within 24 hours.</span>
                    </div>
                </div>
            `;
        } else if (challenge.status === 'winner') {
             statusMessagesContainer.innerHTML = `
                <div class="winner-status text-sm mb-4">
                     <div class="flex items-center text-green-700">
                         <i class="fas fa-trophy mr-2"></i>
                         <span class="winner-text">Winner! Prize: ₹${challenge.prizeAmount || challenge.prize}</span>
                     </div>
                 </div>
             `;

             // Display rank for winners
             const rankDisplay = card.querySelector('.rank-display');
             if (rankDisplay && challenge.rank) {
                 rankDisplay.innerHTML = `
                     <div class="rank-info text-sm mb-4">
                         <div class="flex items-center text-yellow-500">
                             <i class="fas fa-medal mr-2"></i>
                             <span class="rank-text">Rank: ${challenge.rank}</span>
                         </div>
                     </div>
                 `;
             } else if (rankDisplay) {
                 rankDisplay.innerHTML = ''; // Clear rank display if no rank available
             }
         } else if (challenge.status === 'loser') {
              statusMessagesContainer.innerHTML = `
                 <div class="loser-status text-sm mb-4">
                     <div class="flex items-center text-red-700">
                         <i class="fas fa-times-circle mr-2"></i>
                         <span class="loser-text">Not a winner</span>
                     </div>
                 </div>
             `;
         }
    }

    const continueButton = card.querySelector('.continue-btn');
    if (continueButton) {
        // Set the href and data attribute for the button
        if (challenge.status === 'completed' || challenge.status === 'winner') {
            continueButton.href = `quiz/results.html?contestId=${challenge.challengeId}`;
        } else {
            continueButton.href = `quiz/quiz.html?contestId=${challenge.challengeId}`;
        }
        continueButton.dataset.challengeId = challenge.challengeId;

        // Update button text and style based on status
        if (challenge.status === 'completed') {
            continueButton.textContent = 'View Result';
            continueButton.classList.add('result-btn');
            continueButton.disabled = false; // Allow clicking to view results
            continueButton.classList.remove('opacity-50', 'cursor-not-allowed'); // Ensure not styled as disabled
        } else if (challenge.status === 'winner') {
            continueButton.textContent = 'View Result';
            continueButton.classList.add('result-btn');
            continueButton.disabled = false; // Enable button for winners to view results
            continueButton.classList.remove('opacity-50', 'cursor-not-allowed');
        } else if (challenge.status === 'eliminated') {
            continueButton.textContent = 'Eliminated';
            continueButton.disabled = true;
            continueButton.classList.add('opacity-50', 'cursor-not-allowed');
            continueButton.classList.remove('result-btn'); // Ensure no result style
        } else if (challenge.status === 'unavailable') {
            continueButton.textContent = 'View Details';
            continueButton.disabled = true;
            continueButton.classList.add('opacity-50', 'cursor-not-allowed');
            continueButton.classList.remove('result-btn'); // Ensure no result style
        } else { // Status is 'joined' or 'active'
            continueButton.textContent = 'Continue Challenge';
            continueButton.disabled = false;
            continueButton.classList.remove('opacity-50', 'cursor-not-allowed', 'result-btn'); // Ensure default style
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
        
        if (contestsSnapshot.empty) {
            console.log('No contests found for user');
            showNoChallenges();
            return;
        }

        const challengesToDisplay = [];

        // Process each contest the user is participating in
        for (const contestDoc of contestsSnapshot.docs) {
            const contestData = contestDoc.data();
            const challengeId = contestDoc.id;

            // Get user's challenge history for this specific contest
            const userRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userRef);
            const userData = userDocSnap.data();
            const challengeHistory = Array.isArray(userData.challengeHistory) ? userData.challengeHistory : [];
            const historyEntry = challengeHistory.find(entry => entry.contestId === challengeId);

            // Check if user is a winner in this contest
            let winnerData = null;
            if (contestData.winners && Array.isArray(contestData.winners)) {
                winnerData = contestData.winners.find(winner => winner.userId === userId);
            }

            // Create challenge object with contest data and history
            const challenge = {
                challengeId: challengeId,
                title: contestData.title || 'Untitled Contest',
                participants: contestData.participants?.length || 0,
                maxParticipants: contestData.maxSpots || 0,
                status: winnerData ? 'winner' : (historyEntry?.status || 'active'),
                joinedAt: historyEntry?.joinedAt || contestData.createdAt || new Date(),
                entryFee: contestData.entryFee || 0,
                prize: contestData.prize || 0,
                subject: contestData.subject || 'General',
                rank: winnerData?.rank || null,
                prizeAmount: winnerData?.prize || null
            };

            challengesToDisplay.push(challenge);
        }

        // Sort challenges by joinedAt date descending
        challengesToDisplay.sort((a, b) => {
            const dateA = a.joinedAt instanceof Date ? a.joinedAt.getTime() : 
                         (a.joinedAt?.toMillis?.() || 0);
            const dateB = b.joinedAt instanceof Date ? b.joinedAt.getTime() : 
                         (b.joinedAt?.toMillis?.() || 0);
            return dateB - dateA;
        });

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

// Load user's challenges
async function loadMyChallenges() {
    try {
        const user = auth.currentUser;
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            showError('User data not found');
            return;
        }

        const userData = userDoc.data();
        const challengeHistory = userData.challengeHistory || [];

        if (challengeHistory.length === 0) {
            showNoChallenges();
            return;
        }

        // Get all contests
        const contestsSnapshot = await getDocs(collection(db, 'contests'));
        const contests = {};
        contestsSnapshot.forEach(doc => {
            contests[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Sort challenges by joined date (newest first)
        challengeHistory.sort((a, b) => b.joinedAt - a.joinedAt);

        const container = document.getElementById('myChallengesContainer');
        container.innerHTML = '';

        challengeHistory.forEach(challenge => {
            const contest = contests[challenge.contestId];
            if (!contest) return;

            const card = document.createElement('div');
            card.className = 'bg-white shadow-md rounded-2xl p-4 flex flex-col justify-between h-full';
            
            const status = getChallengeStatus(contest);
            const statusClass = getStatusClass(status);
            
            card.innerHTML = `
                <div>
                    <h3 class="challenge-title text-xl font-semibold text-gray-900 mb-2">${contest.title}</h3>
                    <div class="flex items-center text-sm text-gray-600 mb-2">
                        <i class="fas fa-calendar-alt mr-1"></i>
                        <span class="date-text">${formatDate(challenge.joinedAt)}</span>
                        <span class="status-badge ${statusClass}">${status}</span>
                    </div>
                    <div class="flex items-center text-sm text-gray-600 mb-2">
                        <i class="fas fa-coins mr-1"></i>
                        <span class="entry-prize-text">Entry: ₹${contest.entryFee} | Prize: ₹${contest.prize}</span>
                    </div>
                    <div class="flex items-center text-sm text-gray-600 mb-4">
                        <i class="fas fa-users mr-1"></i>
                        <span class="participants-text">${contest.participants?.length || 0} Participants</span>
                    </div>
                    ${challenge.status === 'winner' ? `
                        <div class="winner-status text-sm mb-4">
                            <div class="flex items-center text-yellow-600">
                                <i class="fas fa-trophy mr-2"></i>
                                <span class="winner-text">Winner! Prize: ₹${challenge.prizeAmount || contest.prize}</span>
                            </div>
                        </div>
                    ` : challenge.status === 'loser' ? `
                        <div class="loser-status text-sm mb-4">
                            <div class="flex items-center text-red-600">
                                <i class="fas fa-times-circle mr-2"></i>
                                <span class="loser-text">Not a winner</span>
                            </div>
                        </div>
                    ` : ''}
                    ${challenge.status === 'pending' ? `
                        <div class="pending-status text-sm mb-4">
                            <div class="flex items-center text-yellow-600">
                                <i class="fas fa-clock mr-2"></i>
                                <span class="pending-text">Results pending</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
                ${status === 'Ongoing' ? `
                    <a href="quiz/quiz.html?contestId=${contest.id}" class="continue-btn bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-center transition duration-200 ease-in-out">
                        Continue Challenge
                    </a>
                ` : ''}
            `;
            
            container.appendChild(card);
        });

        hideLoading();
    } catch (error) {
        console.error('Error loading challenges:', error);
        showError('Failed to load challenges. Please try again.');
    }
}