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
        participantsModal.classList.add('active');

        const participantsList = document.getElementById('participants-list');
        const participantsLoadingState = document.getElementById('participants-loading-state');
        const participantsErrorState = document.getElementById('participants-error-state');
        const noParticipantsState = document.getElementById('no-participants-state');
        const retryParticipantsBtn = document.getElementById('retry-participants-btn');

        // Log to see if elements are found
        console.log('participantsList:', participantsList);
        console.log('participantsLoadingState:', participantsLoadingState);
        console.log('participantsErrorState:', participantsErrorState);
        console.log('noParticipantsState:', noParticipantsState);
        console.log('retryParticipantsBtn:', retryParticipantsBtn);

        // Show loading state, hide others
        if (participantsLoadingState) participantsLoadingState.style.display = 'flex';
        if (participantsErrorState) participantsErrorState.style.display = 'none';
        if (noParticipantsState) noParticipantsState.style.display = 'none';
        if (participantsList) participantsList.innerHTML = ''; // Clear previous participants

        // Attach retry listener
        if (retryParticipantsBtn) {
            retryParticipantsBtn.onclick = () => viewParticipants(contestId);
        }

        const contestRef = doc(db, 'contests', contestId);
        const contestDoc = await getDoc(contestRef);

        if (!contestDoc.exists()) {
            throw new Error('Contest not found');
        }

        currentContestData = contestDoc.data();
        const participants = currentContestData.participants || [];

        if (participants.length === 0) {
            if (participantsLoadingState) participantsLoadingState.style.display = 'none';
            if (noParticipantsState) noParticipantsState.style.display = 'flex';
            return;
        }

        let loadedParticipants = [];
        for (const participantId of participants) {
            try {
                const userRef = doc(db, 'users', participantId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const isWinner = currentContestData.winners?.some(w => w.userId === participantId);

                    const userContests = userData.contests || [];
                    console.log('User Data:', userData);
                    console.log('User Contests for user:', userData.contests);
                    console.log('Contest ID being searched:', contestId);
                    const contestStats = userContests.find(c => c.contestId === contestId);
                    console.log('Found Contest Stats:', contestStats);

                    const stats = {
                        score: contestStats?.score || 0,
                        correct: contestStats?.correctQuestions || 0,
                        wrong: contestStats?.wrongQuestions || 0,
                        timeTaken: contestStats?.timeTaken || 0
                    };

                    loadedParticipants.push({
                        id: participantId,
                        name: userData.name,
                        email: userData.email,
                        isWinner: isWinner,
                        stats: stats
                    });
                }
            } catch (error) {
                console.error('Error loading participant:', error);
            }
        }

        participantsLoadingState.style.display = 'none';

        if (loadedParticipants.length === 0) {
            noParticipantsState.style.display = 'flex';
            return;
        }

        // Sort participants by score (descending) then time taken (ascending)
        loadedParticipants.sort((a, b) => {
            if (b.stats.score !== a.stats.score) {
                return b.stats.score - a.stats.score;
            }
            return a.stats.timeTaken - b.stats.timeTaken;
        });

        loadedParticipants.forEach((participant, index) => {
            const participantRow = document.createElement('div');
            participantRow.className = 'participant-row';
            // Add rank-specific class for styling
            if (index === 0) participantRow.classList.add('rank-1');
            else if (index === 1) participantRow.classList.add('rank-2');
            else if (index === 2) participantRow.classList.add('rank-3');

            participantRow.innerHTML = `
                <div class="participant-cell">${index + 1}</div>
                <div class="participant-cell name">
                    ${participant.isWinner ? '<i class="fas fa-trophy participant-trophy-icon"></i>' : ''}
                    ${participant.name}
                </div>
                <div class="participant-cell score">${participant.stats.score}</div>
                <div class="participant-cell correct">${participant.stats.correct}</div>
                <div class="participant-cell wrong">${participant.stats.wrong}</div>
                <div class="participant-cell time">${participant.stats.timeTaken}s</div>
                <div class="participant-cell action-buttons">
                    ${!participant.isWinner ? `
                        <button class="winner-btn" onclick="makeWinner('${participant.id}')">
                            <i class="fas fa-trophy"></i>
                            Mark as Winner
                        </button>
                    ` : ''}
                    <button class="delete-participant-btn" onclick="deleteParticipant('${contestId}', '${participant.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            participantsList.appendChild(participantRow);
        });

    } catch (error) {
        console.error('Error viewing participants:', error);
        showToast('Error loading participants', 'error');
        // Ensure these elements are correctly referenced even in error state
        document.getElementById('participants-loading-state').style.display = 'none';
        document.getElementById('participants-error-state').style.display = 'flex';
    }
}

async function deleteParticipant(contestId, userId) {
    if (confirm('Are you sure you want to remove this participant from the challenge?')) {
        try {
            const contestRef = doc(db, 'contests', contestId);
            const contestDoc = await getDoc(contestRef);

            if (!contestDoc.exists()) {
                showToast('Contest not found', 'error');
                return;
            }

            const currentParticipants = contestDoc.data().participants || [];
            const updatedParticipants = currentParticipants.filter(id => id !== userId);

            await updateDoc(contestRef, {
                participants: updatedParticipants
            });

            // Optionally, remove from winners if they were a winner
            const currentWinners = contestDoc.data().winners || [];
            const updatedWinners = currentWinners.filter(winner => winner.userId !== userId);
            await updateDoc(contestRef, {
                winners: updatedWinners
            });

            showToast('Participant removed successfully', 'success');
            viewParticipants(contestId); // Refresh the list
        } catch (error) {
            console.error('Error removing participant:', error);
            showToast('Error removing participant', 'error');
        }
    }
}

// Make winner
async function makeWinner(userId) {
    try {
        currentUserId = userId;
        console.log('makeWinner called for userId:', userId);
        prizeInputModal.classList.add('active');
        prizeInputForm.reset();
        console.log('prizeInputModal should be active now.');
    } catch (error) {
        console.error('Error preparing winner form:', error);
        showToast('Error preparing winner form', 'error');
    }
}

// Handle prize form submission
prizeInputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Prize form submitted.');
    
    try {
        const prizeAmount = parseFloat(document.getElementById('prizeAmount').value);
        const rank = parseInt(document.getElementById('rank').value);
        console.log('Prize Amount:', prizeAmount, 'Rank:', rank);
        
        if (!currentContestId || !currentUserId || !currentContestData) {
            console.error('Missing contest or user data', { currentContestId, currentUserId, currentContestData });
            throw new Error('Missing contest or user data');
        }
        
        // Check if rank is already assigned
        const winnersRef = collection(db, `contests/${currentContestId}/winners`);
        const winnersSnapshot = await getDocs(winnersRef);
        const existingRank = winnersSnapshot.docs.find(doc => doc.data().rank === rank);
        
        if (existingRank) {
            console.warn('This rank is already assigned to another winner', existingRank.data());
            throw new Error('This rank is already assigned to another winner');
        }
        
        // Get user data
        const userRef = doc(db, 'users', currentUserId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            console.error('User not found for userId:', currentUserId);
            throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        console.log('User Data for winner:', userData);
        
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
        
        // Update contest document
        const contestRef = doc(db, 'contests', currentContestId);
        await updateDoc(contestRef, {
            winners: [...(currentContestData.winners || []), {
                userId: currentUserId,
                name: userData.name,
                prize: prizeAmount,
                rank: rank
            }],
            status: 'ended', // Mark contest as ended
            winnerDeclared: true // Add a flag for winner declaration
        });
        console.log('Contest document updated with new winner and status.');
        
        // Update user's contest history with winner status
        const userContestRef = doc(db, `users/${currentUserId}/contests/${currentContestId}`);
        await setDoc(userContestRef, {
            status: 'winner',
            prize: prizeAmount,
            rank: rank,
            updatedAt: serverTimestamp()
        }, { merge: true });
        console.log('User contest history updated with winner status.');
        
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
        // Fetch the contest document to get the winners array
        const contestRef = doc(db, 'contests', contestId);
        const contestDoc = await getDoc(contestRef);

        if (!contestDoc.exists()) {
            showToast('Contest not found', 'error');
            return;
        }

        const contestData = contestDoc.data();
        const winners = contestData.winners || [];
        
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
                        <p class="contest-subtitle">${contestData?.title || 'Contest'}</p>
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
                                        Score: ${winner.score || 'N/A'}
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
    let startTime = challenge.startTime;
    let endTime = challenge.endTime;

    // Convert to Date objects if they are Firestore Timestamps
    if (startTime && typeof startTime.toDate === 'function') {
        startTime = startTime.toDate();
    } else if (startTime) {
        // Attempt to parse if it's a string or other format
        startTime = new Date(startTime);
    }

    if (endTime && typeof endTime.toDate === 'function') {
        endTime = endTime.toDate();
    } else if (endTime) {
        // Attempt to parse if it's a string or other format
        endTime = new Date(endTime);
    }
    
    if (!startTime || !endTime || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return 'Unknown';
    
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

addChallengeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('challenge-title').value;
    const entryFee = parseFloat(document.getElementById('challenge-entry-fee').value);
    const prize = parseFloat(document.getElementById('challenge-prize').value);
    const maxSpots = parseInt(document.getElementById('challenge-max-spots').value);
    const startTime = new Date(document.getElementById('challenge-start-time').value); // Get as Date object
    const endTime = new Date(document.getElementById('challenge-end-time').value);     // Get as Date object
    const totalWinners = parseInt(document.getElementById('challenge-total-winners').value);

    // Basic validation
    if (!title || isNaN(entryFee) || isNaN(prize) || isNaN(maxSpots) || isNaN(totalWinners) || !startTime || !endTime) {
        showToast('Please fill all fields correctly', 'error');
        return;
    }

    if (startTime >= endTime) {
        showToast('Start time must be before end time', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'contests'), {
            title,
            entryFee,
            prize,
            maxSpots,
            filledSpots: 0,
            startTime: startTime, // Store as Date object, Firestore will convert to Timestamp
            endTime: endTime,     // Store as Date object, Firestore will convert to Timestamp
            totalWinners,
            winners: [],
            participants: [],
            status: 'upcoming', // Default status
            createdAt: serverTimestamp()
        });
        showToast('Challenge added successfully', 'success');
        addChallengeModal.classList.remove('active');
        addChallengeForm.reset();
        loadChallenges();
    } catch (error) {
        console.error('Error adding challenge:', error);
        showToast('Error adding challenge', 'error');
    }
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
window.deleteParticipant = deleteParticipant;
