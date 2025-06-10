import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase configuration
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
const loadingSpinner = document.getElementById('loading-spinner');
const resultsContainer = document.getElementById('results-container');

// Utility Functions
function showLoading() {
    loadingSpinner.classList.remove('hidden');
    resultsContainer.style.display = 'none';
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
    resultsContainer.style.display = 'block';
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} mins ${remainingSeconds} sec`;
}

// Get contest ID from URL
function getContestIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('contestId');
}

// Fetch and display results
async function fetchAndDisplayResults() {
    showLoading();
    const contestId = getContestIdFromUrl();
    
    if (!contestId) {
        showError('Contest ID not found in URL');
        return;
    }

    try {
        const user = auth.currentUser;
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        // Fetch contest data
        const contestRef = doc(db, 'contests', contestId);
        const contestDoc = await getDoc(contestRef);
        
        if (!contestDoc.exists()) {
            showError('Contest not found');
            return;
        }

        const contestData = contestDoc.data();

        // Fetch user's challenge history
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            showError('User data not found');
            return;
        }

        const userData = userDoc.data();
        
        // Check if challengeHistory exists and is an array
        if (!userData.challengeHistory || !Array.isArray(userData.challengeHistory)) {
            showError('No quiz history found');
            return;
        }

        // Find the specific contest entry in challengeHistory
        const historyEntry = userData.challengeHistory.find(entry => entry.contestId === contestId);

        if (!historyEntry) {
            showError('Quiz results not found for this contest');
            return;
        }

        // Validate required fields
        if (historyEntry.status !== 'completed') {
            showError('Quiz not completed yet');
            return;
        }

        // Fetch winners
        const winnersRef = collection(db, `contests/${contestId}/winners`);
        const winnersSnapshot = await getDocs(winnersRef);
        const winners = [];

        for (const winnerDoc of winnersSnapshot.docs) {
            const winnerData = winnerDoc.data();
            const winnerUserRef = doc(db, 'users', winnerDoc.id);
            const winnerUserDoc = await getDoc(winnerUserRef);
            
            if (winnerUserDoc.exists()) {
                const winnerUserData = winnerUserDoc.data();
                winners.push({
                    uid: winnerDoc.id,
                    name: winnerUserData.name || 'Anonymous',
                    rank: winnerData.rank || 0,
                    prize: winnerData.prize || 0
                });
            }
        }

        // Sort winners by rank
        winners.sort((a, b) => a.rank - b.rank);

        // Display results
        displayResults(contestData, historyEntry, winners);
        hideLoading();

    } catch (error) {
        console.error('Error fetching results:', error);
        showError('Failed to load results. Please try again later.');
    }
}

function displayResults(contestData, historyEntry, winners) {
    const isWinner = historyEntry.status === 'winner';
    const winnerData = winners.find(w => w.uid === auth.currentUser.uid);

    // Format time taken
    const timeTaken = typeof historyEntry.timeTaken === 'number' 
        ? formatTime(historyEntry.timeTaken)
        : historyEntry.timeTaken || 'N/A';

    resultsContainer.innerHTML = `
        <h2>${contestData.title}</h2>
        
        ${isWinner ? `
            <div class="winner-announcement">
                <h3>🎉 Congratulations! You're a Winner! 🎉</h3>
                <div class="winner-card">
                    <h4>Your Achievement</h4>
                    <div class="winner-info">
                        <i class="fas fa-medal"></i>
                        <p>Rank: ${winnerData.rank}</p>
                    </div>
                    <div class="winner-info">
                        <i class="fas fa-trophy"></i>
                        <p>Prize: ₹${winnerData.prize}</p>
                    </div>
                </div>
            </div>
        ` : ''}

        <div class="results-stats">
            <div class="stat-card">
                <h3>Total Score</h3>
                <p>${historyEntry.score || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Correct Answers</h3>
                <p>${historyEntry.correct || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Wrong Answers</h3>
                <p>${historyEntry.wrong || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Time Taken</h3>
                <p>${timeTaken}</p>
            </div>
        </div>

        ${winners.length > 0 ? `
            <div class="winner-announcement">
                <h3>🏆 Contest Winners</h3>
                ${winners.map(winner => `
                    <div class="winner-card">
                        <h4>Rank ${winner.rank}</h4>
                        <div class="winner-info">
                            <i class="fas fa-user"></i>
                            <p>${winner.name}</p>
                        </div>
                        <div class="winner-info">
                            <i class="fas fa-trophy"></i>
                            <p>Prize: ₹${winner.prize}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        <button id="back-to-contests" onclick="window.location.href='../my-contests.html'">
            <i class="fas fa-arrow-left"></i>
            Back to My Contests
        </button>
    `;
}

function showError(message) {
    resultsContainer.innerHTML = `
        <div class="error-message" style="text-align: center; padding: 2rem;">
            <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
            <p style="font-size: 1.2rem; color: #4b5563; margin-bottom: 1.5rem;">${message}</p>
            <button onclick="window.location.href='../my-contests.html'" style="
                padding: 0.75rem 1.5rem;
                font-size: 1rem;
                font-weight: 600;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: transform 0.2s ease;
            ">
                <i class="fas fa-arrow-left"></i>
                Back to My Contests
            </button>
        </div>
    `;
    hideLoading();
}

// Initialize
onAuthStateChanged(auth, (user) => {
    if (user) {
        fetchAndDisplayResults();
    } else {
        window.location.href = '../login.html';
    }
}); 