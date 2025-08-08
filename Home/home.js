// Firebase SDKs ko import kar rahe hain
// Ab hum Firebase ko global object se access karenge, imports ki zaroorat nahi

// Aapki Firebase project ki configuration details
const firebaseConfig = {
    apiKey: "AIzaSyBgCHdqzcsiB9VBTsv4O1fU2R88GVoOOyA",
    authDomain: "quizarena-c222d.firebaseapp.com",
    projectId: "quizarena-c222d",
    storageBucket: "quizarena-c222d.firebasestorage.app",
    messagingSenderId: "892135666693",
    appId: "1:892135666693:web:4f8bf849019603a937586c"
};

// Firebase ko initialize kar rahe hain
// Sirf ek baar initialize ho, iska dhyan rakhein
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Jab poora HTML page load ho jaye, tab yeh function chalega
document.addEventListener('DOMContentLoaded', () => {
    
    // HTML se zaroori elements ko select kar rahe hain
    const contestsGrid = document.querySelector('.all-contests-grid');
    const loadingState = document.querySelector('.loading-state');
    const errorState = document.querySelector('.error-state');
    const contestCardTemplate = document.getElementById('contest-card-template');
    const notification = document.getElementById('notification');

    let userCompletedContests = new Set(); // To store IDs of contests user has completed
    let userContestResults = new Map(); // To store user's rank and prize for completed contests
    let userWalletBalance = 0; // User ka wallet balance store karne ke liye
    let contestsLoaded = false; // Flag taki contests baar baar load na ho
    let currentUser = null;
    let userDataFetched = false; // Naya flag user data ko ek baar fetch karne ke liye

    // Function to show notifications
    function showNotification(message, type) {
        notification.textContent = message;
        notification.className = 'notification'; // Reset classes
        notification.classList.add(type, 'show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000); // Hide after 3 seconds
    }

    // Yeh function contest ka data lekar uska HTML card banata hai
    const createContestCard = (contestData, contestId) => {
        const card = contestCardTemplate.content.cloneNode(true).querySelector('.contest-card');

        card.querySelector('.contest-title').textContent = contestData.title || 'No Title';
        const prizeTextElement = card.querySelector('.prize-text');
        prizeTextElement.innerHTML = `<span class="prize-label">PRIZE</span><span class="prize-amount">₹${contestData.prize || 0}</span>`;

        if (contestData.winnerDeclared) {
            prizeTextElement.querySelector('.prize-amount').classList.add('winner-declared-prize');
        }

        card.querySelector('.entry-fee-text').textContent = `Entry: ₹${contestData.entryFee || 0}`;
        
        const spotsFilled = contestData.filledSpots || 0;
        const totalSpots = contestData.maxSpots || 0;
        card.querySelector('.spots-filled').textContent = `${spotsFilled} / ${totalSpots} spots`;

        const progressPercentage = totalSpots > 0 ? (spotsFilled / totalSpots) * 100 : 0;
        card.querySelector('.progress-fill').style.width = `${progressPercentage}%`;
        card.querySelector('.progress-percentage').textContent = `${Math.round(progressPercentage)}%`;
        card.querySelector('.progress-text').textContent = `${totalSpots - spotsFilled} spots left`;

        const statusBadge = card.querySelector('.status-badge');
        if (contestData.status === 'active') {
            statusBadge.textContent = 'Live';
            statusBadge.classList.add('live');
        } else if (contestData.status === 'upcoming') {
            statusBadge.textContent = 'Upcoming';
            statusBadge.classList.add('upcoming');
        } else {
            statusBadge.textContent = 'Ended';
            statusBadge.classList.add('ended');
        }

        const joinBtn = card.querySelector('.join-btn');
        const joinTextSpan = joinBtn.querySelector('.join-text');

        const joinButtonClickHandler = async () => {
            if (!currentUser) {
                showNotification("Please log in to join contest.", 'error');
                return;
            }

            const entryFee = contestData.entryFee || 0;
            if (userWalletBalance < entryFee) {
                showNotification(`Insufficient funds! You need ₹${entryFee - userWalletBalance} more.`, 'error');
                return;
            }

            try {
                const walletRef = db.collection("wallets").doc(currentUser.uid);
                const contestRef = db.collection("contests").doc(contestId);

                await db.runTransaction(async (transaction) => {
                    const walletDoc = await transaction.get(walletRef);
                    if (!walletDoc.exists) throw new Error("Wallet not found!");

                    const currentBalance = walletDoc.data().balance || 0;
                    if (currentBalance < entryFee) throw new Error("Insufficient funds!");

                    const newBalance = currentBalance - entryFee;
                    transaction.update(walletRef, { balance: newBalance });
                    transaction.update(contestRef, { 
                        participants: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                    });
                });

                showNotification('Contest Joined Successfully', 'success');
                joinTextSpan.textContent = 'Continue';
                joinBtn.classList.add('joined');
                joinBtn.removeEventListener('click', joinButtonClickHandler);
                joinBtn.addEventListener('click', () => window.location.href = `/Home/quiz/quiz.html?contestId=${contestId}`);
                userWalletBalance -= entryFee;

            } catch (error) {
                console.error("Error joining contest:", error);
                showNotification(`Failed to join: ${error.message}`, 'error');
            }
        };

        const hasJoined = contestData.participants && contestData.participants.includes(currentUser.uid);
        const hasPlayedQuiz = userCompletedContests.has(contestId);

        if (hasPlayedQuiz) {
            joinTextSpan.textContent = 'View Result';
            joinBtn.classList.add('view-result-btn');
            joinBtn.addEventListener('click', () => window.location.href = `/Home/quiz/results.html?contestId=${contestId}`);
        } else if (hasJoined) {
            joinTextSpan.textContent = 'Continue';
            joinBtn.classList.add('joined');
            joinBtn.addEventListener('click', () => window.location.href = `/Home/quiz/quiz.html?contestId=${contestId}`);
        } else {
            joinTextSpan.textContent = `Join for ₹${contestData.entryFee || 0}`;
            joinBtn.addEventListener('click', joinButtonClickHandler);
        }

        return card;
    };

    const loadContests = async () => {
        loadingState.style.display = 'flex';
        errorState.style.display = 'none';
        contestsGrid.innerHTML = '';

        try {
            const contestsQuery = db.collection("contests").where("status", "in", ["active", "upcoming"]).limit(10);
            const querySnapshot = await contestsQuery.get();
            
            loadingState.style.display = 'none';

            if (querySnapshot.empty) {
                contestsGrid.innerHTML = '<p>No contests available right now.</p>';
                return;
            }

            querySnapshot.forEach(doc => {
                const contestCard = createContestCard(doc.data(), doc.id);
                contestsGrid.appendChild(contestCard);
            });

        } catch (error) {
            console.error("Error loading contests: ", error);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
        }
    };

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            if (!userDataFetched) {
                const userDocRef = db.collection("users").doc(user.uid);
                try {
                    const userDocSnap = await userDocRef.get();
                    if (userDocSnap.exists) {
                        const userData = userDocSnap.data();
                        const walletDocRef = db.collection("wallets").doc(user.uid);
                        const walletDocSnap = await walletDocRef.get();
                        if (walletDocSnap.exists) {
                            userWalletBalance = walletDocSnap.data().balance || 0;
                        }
                        if (userData.contests && Array.isArray(userData.contests)) {
                            userData.contests.forEach(contest => {
                                if (contest.isCompleted) {
                                    userCompletedContests.add(contest.contestId);
                                }
                            });
                        }
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
                userDataFetched = true;
            }
            loadContests();
        } else {
            window.location.href = '/auth/login.html';
        }
    });
});