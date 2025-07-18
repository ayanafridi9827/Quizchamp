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
    getDoc,
    updateDoc
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
const usersTableBody = document.getElementById('users-table-body');
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
        
        usersTableBody.innerHTML = '';
        
        for (const userDoc of querySnapshot.docs) {
            const user = userDoc.data();
            const userId = userDoc.id;

            // Fetch wallet balance from the wallets collection
            let walletBalance = 0;
            try {
                const walletDoc = await getDoc(doc(db, 'wallets', userId));
                if (walletDoc.exists()) {
                    walletBalance = walletDoc.data().balance || 0;
                }
            } catch (error) {
                console.error(`Error fetching wallet for user ${userId}:`, error);
            }

            const userRow = document.createElement('tr');
            userRow.dataset.userId = userId;
            
            userRow.innerHTML = `
                <td>${user.name || 'N/A'}</td>
                <td>${user.email}</td>
                <td class="wallet-balance">₹${walletBalance}</td>
                <td>
                    <button class="action-btn edit-wallet" data-user-id="${userId}" data-current-balance="${walletBalance}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn view-history" data-user-id="${userId}">
                        <i class="fas fa-history"></i> View History
                    </button>
                </td>
            `;
            
            usersTableBody.appendChild(userRow);
        }

        // Add event listeners to view history buttons
        document.querySelectorAll('.view-history').forEach(button => {
            button.addEventListener('click', () => showChallengeHistory(button.dataset.userId));
        });

        // Add event listeners to edit wallet buttons
        document.querySelectorAll('.edit-wallet').forEach(button => {
            button.addEventListener('click', () => {
                const userId = button.dataset.userId;
                const currentBalance = button.dataset.currentBalance;
                showEditWalletModal(userId, currentBalance);
            });
        });
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

function showEditWalletModal(userId, currentBalance) {
    const editWalletModal = document.getElementById('edit-wallet-modal');
    const closeWalletModalBtn = document.getElementById('close-wallet-modal');
    const editWalletForm = document.getElementById('edit-wallet-form');
    const newBalanceInput = document.getElementById('new-balance');
    const userNameEl = document.getElementById('wallet-user-name');
    const userEmailEl = document.getElementById('wallet-user-email');
    const userAvatarEl = document.getElementById('wallet-user-avatar');

    // Fetch user details to display in the modal
    const userRow = usersTableBody.querySelector(`tr[data-user-id="${userId}"]`);
    const name = userRow.cells[0].textContent;
    const email = userRow.cells[1].textContent;

    userNameEl.textContent = name;
    userEmailEl.textContent = email;
    userAvatarEl.textContent = name.charAt(0).toUpperCase();
    newBalanceInput.value = currentBalance;

    editWalletModal.classList.add('active');

    closeWalletModalBtn.addEventListener('click', () => {
        editWalletModal.classList.remove('active');
    });

    editWalletForm.onsubmit = async (e) => {
        e.preventDefault();
        const newBalance = parseFloat(newBalanceInput.value);

        if (isNaN(newBalance) || newBalance < 0) {
            alert('Please enter a valid balance.');
            return;
        }

        try {
            const walletRef = doc(db, 'wallets', userId);
            await updateDoc(walletRef, { balance: newBalance });
            alert('Wallet balance updated successfully!');
            editWalletModal.classList.remove('active');
            fetchUsers(); // Refresh the user list
        } catch (error) {
            console.error('Error updating wallet balance:', error);
            alert('Failed to update wallet balance.');
        }
    };
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
    const userRows = usersTableBody.getElementsByTagName('tr');
    
    Array.from(userRows).forEach(row => {
        const name = row.cells[0].textContent.toLowerCase();
        const email = row.cells[1].textContent.toLowerCase();
        
        if (name.includes(searchTerm) || email.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
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