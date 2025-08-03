import { db, auth } from '../../../firebase-config.js';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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
const editChallengeModal = document.getElementById('edit-challenge-modal');
const closeEditModalBtn = document.getElementById('close-edit-modal');
const editChallengeForm = document.getElementById('edit-challenge-form');

// Global variables
let currentContestId = null;
let currentUserId = null;
let currentContestData = null;

// Helper function to show toasts
function showToast(message, type = 'success') {
    toast.className = `toast ${type} show`;
    toastMessage.textContent = message;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Helper function to get challenge status
function getChallengeStatus(challenge) {
    return challenge.status;
}

// Load challenges from Firestore
async function loadChallenges() {
    challengesGrid.innerHTML = ''; // Clear existing challenges
    try {
        const querySnapshot = await getDocs(collection(db, 'contests'));
        if (querySnapshot.empty) {
            challengesGrid.innerHTML = '<p class="no-challenges">No challenges found.</p>';
            return;
        }
        querySnapshot.forEach((doc) => {
            createChallengeCard(doc.id, doc.data());
        });
    } catch (error) {
        console.error('Error loading challenges:', error);
        showToast('Error loading challenges', 'error');
    }
}

function createChallengeCard(id, challenge) {
    const card = document.createElement('div');
    card.className = 'challenge-card';
    
    const status = getChallengeStatus(challenge);
    const statusClass = status ? status.toLowerCase() : 'unknown';
    
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

        if (participantsLoadingState) participantsLoadingState.style.display = 'flex';
        if (participantsErrorState) participantsErrorState.style.display = 'none';
        if (noParticipantsState) noParticipantsState.style.display = 'none';
        if (participantsList) participantsList.innerHTML = '';

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
                    const contestStats = userContests.find(c => c.contestId === contestId);
                    const isLoser = contestStats?.status === 'loser';

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
                        isLoser: isLoser, // Explicitly add isLoser here
                        stats: stats
                    });
                }
            } catch (error) {
                console.error('Error loading participant:', error);
            }
        }

        if(participantsLoadingState) participantsLoadingState.style.display = 'none';

        if (loadedParticipants.length === 0) {
            if(noParticipantsState) noParticipantsState.style.display = 'flex';
            return;
        }

        loadedParticipants.sort((a, b) => {
            if (b.stats.score !== a.stats.score) {
                return b.stats.score - a.stats.score;
            }
            return a.stats.timeTaken - b.stats.timeTaken;
        });

        // Clear the list before rendering
        participantsList.innerHTML = '';

        // Render each participant using the corrected logic
        loadedParticipants.forEach((participant, index) => {
            const participantRow = document.createElement('div');
            participantRow.className = 'participant-row';

            // Apply ranking classes
            if (index === 0) participantRow.classList.add('rank-1');
            else if (index === 1) participantRow.classList.add('rank-2');
            else if (index === 2) participantRow.classList.add('rank-3');
            
            // **CRITICAL FIX**: Apply loser class for styling
            if (participant.isLoser) {
                participantRow.classList.add('loser-row');
            }

            // **CRITICAL FIX**: Build the name cell with loser emoji
            let nameHtml = participant.name;
            if (participant.isWinner) {
                nameHtml = `<i class="fas fa-trophy participant-trophy-icon"></i> ${nameHtml}`;
            }
            if (participant.isLoser) {
                nameHtml = `👎 ${nameHtml}`;
            }

            let actionButtonsHtml = '';
            if (participant.isWinner) {
                actionButtonsHtml = `
                    <button class="edit-winner-btn" onclick="editWinner('${contestId}', '${participant.id}')" title="Edit Winner"><i class="fas fa-edit"></i></button>
                    <button class="remove-winner-btn" onclick="removeWinner('${contestId}', '${participant.id}')" title="Remove Winner"><i class="fas fa-user-times"></i></button>
                `;
            } else if (participant.isLoser) {
                // No action buttons for losers
                actionButtonsHtml = '';
            } else {
                actionButtonsHtml = `
                    <button class="winner-btn" onclick="makeWinner('${participant.id}')"><i class="fas fa-trophy"></i> Mark as Winner</button>
                    <button class="loser-btn" onclick="markAsLoser('${contestId}', '${participant.id}')" title="Mark as Loser"><i class="fas fa-times-circle"></i></button>
                `;
            }
            // Always add the delete button
            actionButtonsHtml += ` <button class="delete-participant-btn" onclick="deleteParticipant('${contestId}', '${participant.id}')"><i class="fas fa-trash"></i></button>`;

            // Set the final HTML for the row
            participantRow.innerHTML = `
                <div class="participant-cell">${index + 1}</div>
                <div class="participant-cell name">${nameHtml}</div>
                <div class="participant-cell score">${participant.stats.score}</div>
                <div class="participant-cell correct">${participant.stats.correct}</div>
                <div class="participant-cell wrong">${participant.stats.wrong}</div>
                <div class="participant-cell time">${participant.stats.timeTaken}s</div>
                <div class="participant-cell action-buttons">${actionButtonsHtml}</div>
            `;
            
            participantsList.appendChild(participantRow);
        });

    } catch (error) {
        console.error('Error viewing participants:', error);
        showToast('Error loading participants', 'error');
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

            const currentWinners = contestDoc.data().winners || [];
            const updatedWinners = currentWinners.filter(winner => winner.userId !== userId);
            await updateDoc(contestRef, {
                winners: updatedWinners
            });

            showToast('Participant removed successfully', 'success');
            viewParticipants(contestId);
        } catch (error) {
            console.error('Error removing participant:', error);
            showToast('Error removing participant', 'error');
        }
    }
}

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

async function handlePrizeInputFormSubmit(e) {
    e.preventDefault();
    
    const isEditing = prizeInputForm.dataset.editing === 'true';

    try {
        const newPrizeAmount = parseFloat(document.getElementById('prizeAmount').value);
        const newRank = parseInt(document.getElementById('rank').value);
        
        if (!currentContestId || !currentUserId || !currentContestData) {
            throw new Error('Missing contest or user data');
        }
        
        // Check if the rank is already assigned to a *different* user
        const existingWinnerWithRank = currentContestData.winners?.find(w => w.rank === newRank);
        if (existingWinnerWithRank && existingWinnerWithRank.userId !== currentUserId) {
            throw new Error('This rank is already assigned to another winner');
        }
        
        const userRef = doc(db, 'users', currentUserId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        // This block runs when a winner is being set or edited
        const contestRef = doc(db, 'contests', currentContestId);
        
        // We need the most up-to-date contest data for this operation
        const contestDocForUpdate = await getDoc(contestRef);
        if (!contestDocForUpdate.exists()) {
            throw new Error("Contest data could not be re-fetched for update.");
        }
        const contestDataForUpdate = contestDocForUpdate.data();

        let oldPrizeAmount = 0;
        let updatedWinnersArray;

        if (isEditing) {
            const winnerToEdit = contestDataForUpdate.winners.find(w => w.userId === currentUserId);
            oldPrizeAmount = winnerToEdit ? winnerToEdit.prize : 0;
            
            updatedWinnersArray = contestDataForUpdate.winners.map(w => {
                if (w.userId === currentUserId) {
                    return { ...w, prize: newPrizeAmount, rank: newRank };
                }
                return w;
            });
        } else {
            // This is a new winner being added
            updatedWinnersArray = [...(contestDataForUpdate.winners || []), {
                userId: currentUserId,
                name: userData.name,
                prize: newPrizeAmount,
                rank: newRank
            }];
        }

        // Update the contest with the new winner list and set winnerDeclared to true
        await updateDoc(contestRef, {
            winners: updatedWinnersArray,
            winnerDeclared: true
        });

        // --- AUTOMATICALLY MARK NON-WINNERS AS LOSERS ---
        const allParticipantIds = contestDataForUpdate.participants || [];
        const winnerIds = updatedWinnersArray.map(w => w.userId);

        for (const participantId of allParticipantIds) {
            // If a participant is not in the winners list, mark them as a loser
            if (!winnerIds.includes(participantId)) {
                const participantUserRef = doc(db, 'users', participantId);
                const participantUserDoc = await getDoc(participantUserRef);

                if (participantUserDoc.exists()) {
                    const participantUserData = participantUserDoc.data();
                    const participantContests = participantUserData.contests || [];
                    const pContestIndex = participantContests.findIndex(c => c.contestId === currentContestId);

                    // Update the user's contest status to 'loser'
                    if (pContestIndex > -1 && participantContests[pContestIndex].status !== 'winner') {
                        participantContests[pContestIndex].status = 'loser';
                        participantContests[pContestIndex].updatedAt = new Date();
                        await updateDoc(participantUserRef, { contests: participantContests });
                    }
                }
            }
        }
        
        // Update the winner's own contest data
        const userContests = userData.contests || [];
        const contestIndex = userContests.findIndex(c => c.contestId === currentContestId);

        if (contestIndex > -1) {
            userContests[contestIndex].status = 'winner';
            userContests[contestIndex].prize = newPrizeAmount;
            userContests[contestIndex].rank = newRank;
            userContests[contestIndex].updatedAt = new Date();
            await updateDoc(userRef, { contests: userContests });
        }
        
        // Update the user's wallet
        const walletRef = doc(db, 'wallets', currentUserId);
        const walletDoc = await getDoc(walletRef);
        const prizeDifference = newPrizeAmount - oldPrizeAmount;

        if (walletDoc.exists()) {
            const walletData = walletDoc.data();
            const newBalance = (walletData.balance || 0) + prizeDifference;
            const transactionType = isEditing ? 'Prize Adjusted' : 'Contest Prize';
            const transactionDescription = isEditing 
                ? `Prize for ${currentContestData.title} adjusted by admin`
                : currentContestData.title;

            await updateDoc(walletRef, {
                balance: newBalance,
                deposits: [...(walletData.deposits || []), {
                    amount: prizeDifference,
                    timestamp: new Date(),
                    type: transactionType,
                    description: transactionDescription
                }]
            });
        } else if (!isEditing) { // Only create a new wallet if it's a new winner
            await setDoc(walletRef, {
                balance: newPrizeAmount,
                deposits: [{
                    amount: newPrizeAmount,
                    timestamp: new Date(),
                    type: 'Contest Prize',
                    description: currentContestData.title
                }]
            });
        }

        showToast(isEditing ? 'Winner updated successfully' : 'Winner marked successfully', 'success');
        prizeInputModal.classList.remove('active');
        delete prizeInputForm.dataset.editing; // Clean up the flag
        
        viewParticipants(currentContestId);
        
    } catch (error) {
        console.error('Error marking/updating winner:', error);
        showToast(error.message || 'An error occurred', 'error');
    }
}

async function viewWinners(contestId) {
    try {
        const contestRef = doc(db, 'contests', contestId);
        const contestDoc = await getDoc(contestRef);

        if (!contestDoc.exists()) {
            showToast('Contest not found', 'error');
            return;
        }

        const contestData = contestDoc.data();
        const winners = contestData.winners || [];
        
        winners.sort((a, b) => a.rank - b.rank);
        
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

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadChallenges();
        } else {
            window.location.href = '../index.html';
        }
    });

    addChallengeBtn.addEventListener('click', () => {
        addChallengeModal.classList.add('active');
    });

    closeModalBtn.addEventListener('click', () => {
        addChallengeModal.classList.remove('active');
    });

    closeEditModalBtn.addEventListener('click', () => {
        editChallengeModal.classList.remove('active');
    });

    closeParticipantsModal.addEventListener('click', () => {
        participantsModal.classList.remove('active');
    });

    closePrizeModal.addEventListener('click', () => {
        prizeInputModal.classList.remove('active');
    });

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

        const title = document.getElementById('title').value;
        const entryFee = parseFloat(document.getElementById('entryFee').value);
        const prize = parseFloat(document.getElementById('prize').value);
        const maxSpots = parseInt(document.getElementById('maxSpots').value);
        const totalWinners = parseInt(document.getElementById('totalWinners').value);
        const contestStatus = document.querySelector('input[name="contestStatus"]:checked').value;

        if (!title || isNaN(entryFee) || isNaN(prize) || isNaN(maxSpots) || isNaN(totalWinners)) {
            showToast('Please fill all fields correctly', 'error');
            return;
        }

        try {
            await addDoc(collection(db, 'contests'), {
                title,
                entryFee,
                prize,
                maxSpots,
                filledSpots: 0,
                totalWinners,
                winners: [],
                participants: [],
                status: contestStatus,
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

    prizeInputForm.addEventListener('submit', handlePrizeInputFormSubmit);
});

window.viewParticipants = viewParticipants;
window.makeWinner = makeWinner;
window.viewWinners = viewWinners;

window.editWinner = (contestId, userId) => {
    currentContestId = contestId;
    currentUserId = userId;

    const winnerData = currentContestData.winners?.find(w => w.userId === userId);
    if (!winnerData) {
        showToast('Winner data not found', 'error');
        return;
    }

    document.getElementById('prizeAmount').value = winnerData.prize;
    document.getElementById('rank').value = winnerData.rank;
    
    prizeInputForm.dataset.editing = 'true'; // Set a flag to indicate editing
    prizeInputModal.classList.add('active');
};

window.removeWinner = async (contestId, userId) => {
    if (confirm('Are you sure you want to remove this winner? This will reverse the prize transaction.')) {
        try {
            const contestRef = doc(db, 'contests', contestId);
            const userRef = doc(db, 'users', userId);
            const walletRef = doc(db, 'wallets', userId);

            const contestDoc = await getDoc(contestRef);
            const userDoc = await getDoc(userRef);
            const walletDoc = await getDoc(walletRef);

            if (!contestDoc.exists() || !userDoc.exists()) {
                throw new Error('Contest or user data not found.');
            }

            const contestData = contestDoc.data();
            const userData = userDoc.data();

            const winnerToRemove = contestData.winners?.find(w => w.userId === userId);
            if (!winnerToRemove) {
                throw new Error('Winner not found in contest data.');
            }

            const prizeToReverse = winnerToRemove.prize;

            // Remove winner from contest
            const updatedWinners = contestData.winners.filter(w => w.userId !== userId);
            await updateDoc(contestRef, { winners: updatedWinners });

            // Update user's contest status
            const userContests = userData.contests || [];
            const contestIndex = userContests.findIndex(c => c.contestId === contestId);
            if (contestIndex > -1) {
                userContests[contestIndex].status = 'loser'; // Or 'played'
                delete userContests[contestIndex].prize;
                delete userContests[contestIndex].rank;
                userContests[contestIndex].updatedAt = new Date();
                await updateDoc(userRef, { contests: userContests });
            }

            // Reverse wallet transaction
            if (walletDoc.exists()) {
                const walletData = walletDoc.data();
                const newBalance = (walletData.balance || 0) - prizeToReverse;
                await updateDoc(walletRef, {
                    balance: newBalance,
                    deposits: [...(walletData.deposits || []), {
                        amount: -prizeToReverse,
                        timestamp: new Date(),
                        type: 'Prize Reversed',
                        description: `Prize for ${contestData.title} reversed by admin`
                    }]
                });
            }

            showToast('Winner removed successfully', 'success');
            viewParticipants(contestId);

        } catch (error) {
            console.error('Error removing winner:', error);
            showToast(error.message || 'Could not remove winner', 'error');
        }
    }
};

window.editChallenge = async (id) => {
    try {
        currentContestId = id;
        const contestRef = doc(db, 'contests', id);
        const contestDoc = await getDoc(contestRef);

        if (!contestDoc.exists()) {
            showToast('Contest not found', 'error');
            return;
        }

        const challenge = contestDoc.data();

        document.getElementById('edit-title').value = challenge.title;
        document.getElementById('edit-entryFee').value = challenge.entryFee;
        document.getElementById('edit-prize').value = challenge.prize;
        document.getElementById('edit-maxSpots').value = challenge.maxSpots;
        document.getElementById('edit-totalWinners').value = challenge.totalWinners;
        
        const statusRadio = document.querySelector(`input[name="edit-contestStatus"][value="${challenge.status}"]`);
        if (statusRadio) {
            statusRadio.checked = true;
        }

        editChallengeModal.classList.add('active');

        editChallengeForm.onsubmit = async (e) => {
            e.preventDefault();

            const updatedTitle = document.getElementById('edit-title').value;
            const updatedEntryFee = parseFloat(document.getElementById('edit-entryFee').value);
            const updatedPrize = parseFloat(document.getElementById('edit-prize').value);
            const updatedMaxSpots = parseInt(document.getElementById('edit-maxSpots').value);
            const updatedTotalWinners = parseInt(document.getElementById('edit-totalWinners').value);
            const updatedStatus = document.querySelector('input[name="edit-contestStatus"]:checked').value;

            console.log('Attempting to update contest:', currentContestId, 'with status:', updatedStatus);

            if (!updatedTitle || isNaN(updatedEntryFee) || isNaN(updatedPrize) || isNaN(updatedMaxSpots) || isNaN(updatedTotalWinners)) {
                showToast('Please fill all fields correctly', 'error');
                return;
            }

            try {
                await updateDoc(contestRef, {
                    title: updatedTitle,
                    entryFee: updatedEntryFee,
                    prize: updatedPrize,
                    maxSpots: updatedMaxSpots,
                    totalWinners: updatedTotalWinners,
                    status: updatedStatus
                });
                showToast('Challenge updated successfully', 'success');
                editChallengeModal.classList.remove('active');
                loadChallenges();
            } catch (error) {
                console.error('Error updating challenge:', error);
                showToast('Error updating challenge', 'error');
            }
        };
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showToast('Error opening edit modal', 'error');
    }
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

window.markAsLoser = async (contestId, userId) => {
    if (confirm('Are you sure you want to mark this participant as a loser? This cannot be undone.')) {
        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                showToast('User not found', 'error');
                return;
            }

            const userData = userDoc.data();
            const userContests = userData.contests || [];
            const contestIndex = userContests.findIndex(c => c.contestId === contestId);

            if (contestIndex > -1) {
                userContests[contestIndex].status = 'loser';
                userContests[contestIndex].updatedAt = new Date();

                await updateDoc(userRef, {
                    contests: userContests
                });
            }

            const contestRef = doc(db, 'contests', contestId);
            await updateDoc(contestRef, { winnerDeclared: true });

            showToast('Participant marked as a loser.', 'success');
            viewParticipants(contestId); // Refresh the list
        } catch (error) {
            console.error('Error marking as loser:', error);
            showToast('Error marking as loser', 'error');
        }
    }
};