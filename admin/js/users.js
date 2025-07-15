import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const usersContainer = document.getElementById('users-container');
const searchInput = document.getElementById('search-input');
const logoutBtn = document.getElementById('logout-btn');
const challengeHistoryModal = document.getElementById('challenge-history-modal');
const closeModalBtn = document.getElementById('close-modal');
const challengeHistory = document.getElementById('challenge-history');

// Fetch and display users
async function fetchUsers() {
    try {
        const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(usersQuery);
        
        usersContainer.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const user = doc.data();
            const userCard = document.createElement('div');
            userCard.classList.add('user-card');
            userCard.dataset.userId = doc.id; // Store user ID for search and actions
            
            userCard.innerHTML = `
                <div class="user-card-header">
                    <div class="user-avatar">${user.name ? user.name.charAt(0).toUpperCase() : 'N/A'}</div>
                    <div class="user-info">
                        <div class="user-name">${user.name || 'N/A'}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
                <div class="user-card-body">
                    <div class="info-item">
                        <strong>Wallet Balance:</strong> <span class="wallet-balance">₹${user.walletBalance || 0}</span>
                    </div>
                    <div class="info-item">
                        <strong>Challenges Participated:</strong> <span class="challenges-count">${user.challengeHistory ? user.challengeHistory.length : 0}</span>
                    </div>
                </div>
                <div class="user-card-actions">
                    <button class="action-btn view-history" data-user-id="${doc.id}">
                        <i class="fas fa-history"></i> View History
                    </button>
                </div>
            `;
            
            usersContainer.appendChild(userCard);
        });

        // Add event listeners to view history buttons
        document.querySelectorAll('.view-history').forEach(button => {
            button.addEventListener('click', () => showChallengeHistory(button.dataset.userId));
        });
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

// Show challenge history modal
async function showChallengeHistory(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const user = userDoc.data();
        
        if (user.challengeHistory && user.challengeHistory.length > 0) {
            challengeHistory.innerHTML = user.challengeHistory.map(challenge => `
                <div class="challenge-row">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <strong>${challenge.challengeTitle}</strong>
                        <span class="challenge-status ${challenge.status.toLowerCase()}">${challenge.status}</span>
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.875rem;">
                        <div>Subject: ${challenge.subject}</div>
                        <div>Entry Fee: ₹${challenge.entryFee}</div>
                        <div>Prize: ₹${challenge.prize}</div>
                        <div>Joined: ${new Date(challenge.joinedAt).toLocaleString()}</div>
                    </div>
                </div>
            `).join('');
        } else {
            challengeHistory.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-secondary);">No challenge history available</div>';
        }
        
        challengeHistoryModal.classList.add('active');
    } catch (error) {
        console.error('Error fetching challenge history:', error);
    }
}

// Search functionality
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const userCards = usersContainer.getElementsByClassName('user-card');
    
    Array.from(userCards).forEach(card => {
        const nameElement = card.querySelector('.user-name');
        const emailElement = card.querySelector('.user-email');

        const name = nameElement ? nameElement.textContent.toLowerCase() : '';
        const email = emailElement ? emailElement.textContent.toLowerCase() : '';
        
        if (name.includes(searchTerm) || email.includes(searchTerm)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
});

// Close modal
closeModalBtn.addEventListener('click', () => {
    challengeHistoryModal.classList.remove('active');
});

// Close modal when clicking outside
challengeHistoryModal.addEventListener('click', (e) => {
    if (e.target === challengeHistoryModal) {
        challengeHistoryModal.classList.remove('active');
    }
});

// Logout functionality
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = '../login.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

// Initial fetch
fetchUsers(); 