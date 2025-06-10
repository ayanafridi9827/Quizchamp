// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const challengesGrid = document.getElementById('challenges-grid');
const addChallengeBtn = document.getElementById('add-challenge-btn');
const addChallengeModal = document.getElementById('add-challenge-modal');
const closeModalBtn = document.getElementById('close-modal');
const addChallengeForm = document.getElementById('add-challenge-form');
const participantsModal = document.getElementById('participants-modal');
const closeParticipantsModal = document.getElementById('close-participants-modal');
const participantsGrid = document.getElementById('participants-grid');
const prizeInputModal = document.getElementById('prize-input-modal');
const closePrizeModal = document.getElementById('close-prize-modal');
const prizeInputForm = document.getElementById('prize-input-form');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const filterButtons = document.querySelectorAll('.filter-btn');

// Global variables
let currentContestId = null;
let currentUserId = null;
let currentContestData = null;

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadChallenges();
    } else {
        window.location.href = '../index.html';
    }
});

// Load challenges
async function loadChallenges() {
    try {
        const challengesRef = collection(db, 'contests');
        const q = query(challengesRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        challengesGrid.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const challenge = doc.data();
            createChallengeCard(doc.id, challenge);
        });
    } catch (error) {
        console.error('Error loading challenges:', error);
        showToast('Error loading challenges', 'error');
    }
}

// Create challenge card
function createChallengeCard(id, challenge) {
    const card = document.createElement('div');
    card.className = 'challenge-card';
    
    const status = getChallengeStatus(challenge);
    const statusClass = status.toLowerCase();
    
    card.innerHTML = `
        <div class="challenge-header">
            <div class="challenge-title-section">
                <h3>${challenge.title}</h3>
                <span class="challenge-status ${statusClass}">${status}</span>
            </div>
            <button class="view-participants-btn" onclick="viewParticipants('${id}')">
                <i class="fas fa-eye"></i>
            </button>
        </div>
        <div class="challenge-details">
            <div class="challenge-detail">
                <i class="fas fa-coins"></i>
                <div>
                    <h4>Entry Fee</h4>
                    <p>₹${challenge.entryFee}</p>
                </div>
            </div>
            <div class="challenge-detail">
                <i class="fas fa-trophy"></i>
                <div>
                    <h4>Prize Pool</h4>
                    <p>₹${challenge.prize}</p>
                </div>
            </div>
            <div class="challenge-detail">
                <i class="fas fa-users"></i>
                <div>
                    <h4>Participants</h4>
                    <p>${challenge.participants?.length || 0}/${challenge.maxSpots}</p>
                </div>
            </div>
            <div class="challenge-detail">
                <i class="fas fa-medal"></i>
                <div>
                    <h4>Winners</h4>
                    <p>${challenge.winners?.length || 0}/${challenge.totalWinners}</p>
                </div>
            </div>
        </div>
        <div class="challenge-actions">
            <button class="action-btn view-winners" onclick="viewWinners('${id}')">
                <i class="fas fa-trophy"></i>
                View Winners
            </button>
            <button class="action-btn edit-challenge" onclick="editChallenge('${id}')">
                <i class="fas fa-edit"></i>
                Edit
            </button>
            <button class="action-btn delete-challenge" onclick="deleteChallenge('${id}')">
                <i class="fas fa-trash"></i>
                Delete
            </button>
        </div>
    `;
    
    challengesGrid.appendChild(card);
}

// View participants
async function viewParticipants(contestId) {
    try {
        currentContestId = contestId;
        
        // Show modal and loading state
        participantsModal.classList.add('active');
        participantsGrid.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading participants...</p>
            </div>
        `;
        
        // Get contest data
        const contestRef = doc(db, 'contests', contestId);
        const contestDoc = await getDoc(contestRef);
        
        if (!contestDoc.exists()) {
            throw new Error('Contest not found');
        }
        
        currentContestData = contestDoc.data();
        const participants = currentContestData.participants || [];
        
        if (participants.length === 0) {
            participantsGrid.innerHTML = `
                <div class="no-participants">
                    <i class="fas fa-users-slash"></i>
                    <p>No participants yet</p>
                </div>
            `;
            return;
        }
        
        // Clear grid and start loading participants
        participantsGrid.innerHTML = '';
        let loadedCount = 0;
        
        // Create a container for all participant cards
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'participants-grid';
        
        for (const participantId of participants) {
            try {
                // Update loading progress
                loadedCount++;
                participantsGrid.innerHTML = `
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading participants... (${loadedCount}/${participants.length})</p>
                    </div>
                `;
                
                // Get user data
                const userRef = doc(db, 'users', participantId);
                const userDoc = await getDoc(userRef);
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const isWinner = currentContestData.winners?.some(w => w.userId === participantId);
                    
                    // Get contest-specific stats from user's challengeHistory array
                    const challengeHistory = userData.challengeHistory || [];
                    console.log('Challenge History:', challengeHistory); // Debug log
                    
                    // Find the specific contest stats
                    const contestStats = challengeHistory.find(c => c.contestId === contestId);
                    console.log('Contest Stats:', contestStats); // Debug log
                    
                    // Get the stats with proper fallback
                    const stats = {
                        score: contestStats?.score || 0,
                        correctAnswers: contestStats?.correct || 0,
                        wrongAnswers: contestStats?.wrong || 0,
                        timeTaken: contestStats?.timeTaken || 0
                    };
                    
                    console.log('Stats for user:', participantId, stats); // Debug log
                    
                    const participantCard = document.createElement('div');
                    participantCard.className = `participant-card ${isWinner ? 'winner' : ''}`;
                    
                    participantCard.innerHTML = `
                        <div class="participant-header">
                            <div class="participant-info">
                                <h3 class="participant-name">
                                    ${userData.name}
                                    ${isWinner ? '<span class="winner-badge"><i class="fas fa-crown"></i> Winner</span>' : ''}
                                </h3>
                                <p class="participant-email">${userData.email}</p>
                            </div>
                        </div>
                        <div class="stat-group">
                            <h4><i class="fas fa-chart-line"></i> Contest Performance</h4>
                            <div class="stat-grid">
                                <div class="stat-item">
                                    <div class="stat-label">
                                        <i class="fas fa-star"></i>
                                        Score
                                    </div>
                                    <div class="stat-value">${stats.score}</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-label">
                                        <i class="fas fa-check-circle"></i>
                                        Correct
                                    </div>
                                    <div class="stat-value">${stats.correctAnswers}</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-label">
                                        <i class="fas fa-times-circle"></i>
                                        Wrong
                                    </div>
                                    <div class="stat-value">${stats.wrongAnswers}</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-label">
                                        <i class="fas fa-clock"></i>
                                        Time
                                    </div>
                                    <div class="stat-value">${stats.timeTaken}s</div>
                                </div>
                            </div>
                        </div>
                        ${!isWinner ? `
                            <button class="winner-btn" onclick="makeWinner('${participantId}')">
                                <i class="fas fa-trophy"></i>
                                Mark as Winner
                            </button>
                        ` : ''}
                    `;
                    
                    cardsContainer.appendChild(participantCard);
                }
            } catch (error) {
                console.error('Error loading participant:', error);
            }
        }
        
        // Clear loading state and show all participant cards
        participantsGrid.innerHTML = '';
        participantsGrid.appendChild(cardsContainer);
        
        // If no participants were loaded successfully
        if (cardsContainer.children.length === 0) {
            participantsGrid.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>No participants found</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error viewing participants:', error);
        showToast('Error loading participants', 'error');
        participantsGrid.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading participants</p>
                <button class="retry-btn" onclick="viewParticipants('${contestId}')">
                    <i class="fas fa-redo"></i>
                    Retry
                </button>
            </div>
        `;
    }
}

// Make winner
async function makeWinner(userId) {
    try {
        currentUserId = userId;
        prizeInputModal.classList.add('active');
        prizeInputForm.reset();
    } catch (error) {
        console.error('Error preparing winner form:', error);
        showToast('Error preparing winner form', 'error');
    }
}

// Handle prize form submission
prizeInputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const prizeAmount = parseFloat(document.getElementById('prizeAmount').value);
        const rank = parseInt(document.getElementById('rank').value);
        
        if (!currentContestId || !currentUserId || !currentContestData) {
            throw new Error('Missing contest or user data');
        }
        
        // Check if rank is already assigned
        const winnersRef = collection(db, `contests/${currentContestId}/winners`);
        const winnersSnapshot = await getDocs(winnersRef);
        const existingRank = winnersSnapshot.docs.find(doc => doc.data().rank === rank);
        
        if (existingRank) {
            throw new Error('This rank is already assigned to another winner');
        }
        
        // Get user data
        const userRef = doc(db, 'users', currentUserId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        
        // Create winner data
        const winnerData = {
            userId: currentUserId,
            name: userData.name,
            email: userData.email,
            contestId: currentContestId,
            contestTitle: currentContestData.title,
            prize: prizeAmount,
            rank: rank,
            timestamp: serverTimestamp(),
            entryFee: currentContestData.entryFee,
            totalParticipants: currentContestData.participants?.length || 0,
            contestType: currentContestData.type || 'quiz',
            score: userData.score || 0,
            correctAnswers: userData.correctAnswers || 0,
            wrongAnswers: userData.wrongAnswers || 0,
            timeTaken: userData.timeTaken || 0
        };
        
        // Add to winners subcollection
        const winnerRef = doc(winnersRef, currentUserId);
        await setDoc(winnerRef, winnerData);
        
        // Update contest document
        const contestRef = doc(db, 'contests', currentContestId);
        await updateDoc(contestRef, {
            winners: [...(currentContestData.winners || []), {
                userId: currentUserId,
                name: userData.name,
                prize: prizeAmount,
                rank: rank
            }]
        });
        
        // Update user's challenge history
        const userChallengeRef = doc(db, `users/${currentUserId}/challengeHistory/${currentContestId}`);
        await setDoc(userChallengeRef, {
            status: 'winner',
            prize: prizeAmount,
            rank: rank,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        showToast('Winner marked successfully', 'success');
        prizeInputModal.classList.remove('active');
        
        // Refresh participants view
        viewParticipants(currentContestId);
        
    } catch (error) {
        console.error('Error marking winner:', error);
        showToast(error.message || 'Error marking winner', 'error');
    }
});

// View winners
async function viewWinners(contestId) {
    try {
        const winnersRef = collection(db, `contests/${contestId}/winners`);
        const winnersSnapshot = await getDocs(winnersRef);
        
        const winners = [];
        winnersSnapshot.forEach(doc => {
            winners.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort winners by rank
        winners.sort((a, b) => a.rank - b.rank);
        
        // Create winners modal content
        const winnersModal = document.createElement('div');
        winnersModal.className = 'winners-modal active';
        winnersModal.innerHTML = `
            <div class="winners-modal-content">
                <div class="winners-modal-header">
                    <div class="contest-info">
                        <h2><i class="fas fa-trophy"></i> Contest Winners</h2>
                        <p class="contest-subtitle">${currentContestData?.title || 'Contest'}</p>
                    </div>
                    <button class="close-btn" onclick="this.closest('.winners-modal').remove()">&times;</button>
                </div>
                <div class="winners-list">
                    ${winners.length === 0 ? `
                        <div class="no-winners">
                            <i class="fas fa-trophy"></i>
                            <p>No winners yet</p>
                        </div>
                    ` : winners.map(winner => `
                        <div class="winner-card">
                            <div class="winner-rank">
                                <i class="fas fa-crown"></i>
                                ${winner.rank}
                            </div>
                            <div class="winner-details">
                                <div class="winner-info">
                                    <h3 class="winner-name">${winner.name}</h3>
                                    <p class="winner-email">${winner.email}</p>
                                </div>
                                <div class="winner-stats">
                                    <div class="stat">
                                        <i class="fas fa-coins"></i>
                                        Prize: ₹${winner.prize}
                                    </div>
                                    <div class="stat">
                                        <i class="fas fa-chart-line"></i>
                                        Score: ${winner.score}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(winnersModal);
        
    } catch (error) {
        console.error('Error viewing winners:', error);
        showToast('Error loading winners', 'error');
    }
}

// Helper functions
function getChallengeStatus(challenge) {
    const now = new Date();
    const startTime = challenge.startTime?.toDate();
    const endTime = challenge.endTime?.toDate();
    
    if (!startTime || !endTime) return 'Unknown';
    
    if (now < startTime) return 'Upcoming';
    if (now > endTime) return 'Ended';
    return 'Active';
}

function showToast(message, type = 'success') {
    toast.className = `toast ${type} show`;
    toastMessage.textContent = message;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Event listeners
addChallengeBtn.addEventListener('click', () => {
    addChallengeModal.classList.add('active');
});

closeModalBtn.addEventListener('click', () => {
    addChallengeModal.classList.remove('active');
});

closeParticipantsModal.addEventListener('click', () => {
    participantsModal.classList.remove('active');
});

closePrizeModal.addEventListener('click', () => {
    prizeInputModal.classList.remove('active');
});

// Filter buttons
filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        const filter = button.dataset.filter;
        const cards = document.querySelectorAll('.challenge-card');
        
        cards.forEach(card => {
            const status = card.querySelector('.challenge-status').textContent.toLowerCase();
            if (filter === 'all' || status === filter) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

// Make functions available globally
window.viewParticipants = viewParticipants;
window.makeWinner = makeWinner;
window.viewWinners = viewWinners;
window.editChallenge = (id) => {
    // Implement edit functionality
    showToast('Edit functionality coming soon', 'info');
};
window.deleteChallenge = async (id) => {
    if (confirm('Are you sure you want to delete this challenge?')) {
        try {
            await deleteDoc(doc(db, 'contests', id));
            showToast('Challenge deleted successfully', 'success');
            loadChallenges();
        } catch (error) {
            console.error('Error deleting challenge:', error);
            showToast('Error deleting challenge', 'error');
        }
    }
};
