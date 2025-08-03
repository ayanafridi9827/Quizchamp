import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, runTransaction, query, where, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const withdrawalsTableBody = document.getElementById('withdrawals-table-body');
const logoutBtn = document.getElementById('logout-btn');
const loadingSpinner = document.getElementById('loading-spinner');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const filterButtons = document.querySelectorAll('.filter-btn');

// --- Core Functions ---

/**
 * Fetches and displays withdrawal requests based on a status filter.
 * @param {string} statusFilter The status to filter by ('pending', 'approved', 'rejected', or 'all').
 */
async function fetchWithdrawals(statusFilter = 'pending') {
    loadingSpinner.style.display = 'block';
    emptyState.style.display = 'none';
    withdrawalsTableBody.innerHTML = '';

    try {
        const withdrawalsRef = collection(db, 'withdrawalRequests');
        let withdrawalsQuery;

        // Create the correct query based on the filter
        if (statusFilter === 'all') {
            withdrawalsQuery = query(withdrawalsRef);
        } else {
            withdrawalsQuery = query(withdrawalsRef, where('status', '==', statusFilter));
        }
        
        const querySnapshot = await getDocs(withdrawalsQuery);

        if (querySnapshot.empty) {
            emptyState.style.display = 'block';
            return;
        }

        // Use Promise.all to fetch user data concurrently for efficiency
        const rowsPromises = querySnapshot.docs.map(async (withdrawalDoc) => {
            const withdrawal = withdrawalDoc.data();
            const userId = withdrawal.userId;
            let displayName = withdrawal.fullName || 'N/A'; // Default to fullName from the request

            // Try to get the name from the users collection for accuracy
            if (userId) {
                const userRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists() && userDoc.data().name) {
                    displayName = userDoc.data().name;
                }
            }

            // Create the table row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>₹${withdrawal.amount || 0}</td>
                <td>${withdrawal.fullName || 'N/A'}</td>
                <td>${withdrawal.phoneNumber || 'N/A'}</td>
                <td>${withdrawal.upiId || 'N/A'}</td>
                <td><span class="status-${(withdrawal.status || 'unknown').toLowerCase()}">${withdrawal.status || 'Unknown'}</span></td>
                <td>
                    <div class="action-buttons-container">
                        ${withdrawal.status === 'pending' ? `
                            <button class="action-btn approve-btn" data-withdrawal-id="${withdrawalDoc.id}" title="Approve">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="action-btn reject-btn" data-withdrawal-id="${withdrawalDoc.id}" title="Reject">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;
            return row;
        });

        const rows = await Promise.all(rowsPromises);
        rows.forEach((row, index) => {
            const numberCell = document.createElement('td');
            numberCell.textContent = index + 1;
            row.prepend(numberCell);
            withdrawalsTableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error fetching withdrawals:', error);
        emptyState.innerHTML = '<p>An error occurred while fetching data. Please try again.</p>';
        emptyState.style.display = 'block';
    } finally {
        loadingSpinner.style.display = 'none';
        attachActionListeners();
    }
}

/**
 * Handles the approval or rejection of a withdrawal request.
 * @param {string} withdrawalId The ID of the withdrawal document.
 * @param {'approved' | 'rejected'} newStatus The new status to set.
 */
async function handleWithdrawal(withdrawalId, newStatus) {
    const withdrawalRef = doc(db, 'withdrawalRequests', withdrawalId);

    try {
        await runTransaction(db, async (transaction) => {
            // --- 1. READ ALL DOCUMENTS FIRST ---
            const withdrawalDoc = await transaction.get(withdrawalRef);
            if (!withdrawalDoc.exists()) {
                throw new Error('Withdrawal request does not exist!');
            }

            const withdrawalData = withdrawalDoc.data();
            if (withdrawalData.status !== 'pending') {
                console.log(`Request ${withdrawalId} already processed.`);
                return; // Stop if not pending
            }

            const userId = withdrawalData.userId;
            const amount = withdrawalData.amount;
            let walletRef, walletDoc; // Declare upfront

            // We only need to read the wallet if we are rejecting
            if (newStatus === 'rejected') {
                walletRef = doc(db, 'wallets', userId);
                walletDoc = await transaction.get(walletRef); // Read wallet doc upfront
            }

            // --- 2. PERFORM ALL WRITES NOW ---
            transaction.update(withdrawalRef, { status: newStatus });

            // If rejected, refund the amount to the user's wallet
            if (newStatus === 'rejected') {
                if (walletDoc.exists()) {
                    const currentBalance = walletDoc.data().balance || 0;
                    const newBalance = currentBalance + amount;
                    transaction.update(walletRef, { balance: newBalance });
                } else {
                    // If wallet doesn't exist, create it with the refunded amount
                    transaction.set(walletRef, { balance: amount, userId: userId });
                }
            }
        });
        
        console.log(`Withdrawal ${withdrawalId} successfully handled with status: ${newStatus}`);
        // Refresh the view to show the change
        const activeFilter = document.querySelector('.filter-btn.active').dataset.status;
        fetchWithdrawals(activeFilter);

    } catch (error) {
        console.error('Error handling withdrawal:', error);
        alert(`Failed to handle withdrawal: ${error.message}`);
    }
}

/**
 * Attaches event listeners to the approve/reject buttons.
 */
function attachActionListeners() {
    document.querySelectorAll('.approve-btn').forEach(button => {
        button.addEventListener('click', (e) => handleWithdrawal(e.currentTarget.dataset.withdrawalId, 'approved'));
    });

    document.querySelectorAll('.reject-btn').forEach(button => {
        button.addEventListener('click', (e) => handleWithdrawal(e.currentTarget.dataset.withdrawalId, 'rejected'));
    });
}

// --- Event Listeners & Initial Load ---

// Logout functionality
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = '../login.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

// Refresh button functionality
refreshBtn.addEventListener('click', () => {
    const activeFilter = document.querySelector('.filter-btn.active');
    fetchWithdrawals(activeFilter.dataset.status);
});

// Filter buttons functionality
filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        fetchWithdrawals(button.dataset.status);
    });
});

// Initial data load
fetchWithdrawals('pending');
''