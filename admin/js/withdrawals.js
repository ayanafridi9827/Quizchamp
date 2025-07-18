import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, runTransaction, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBgCHdqzcsiB9VBTsv4O1fU2R88GVoOOyA",
    authDomain: "quizarena-c222d.firebaseapp.com",
    projectId: "quizarena-c222d",
    storageBucket: "quizarena-c222d.firebasestorage.app",
    messagingSenderId: "892135666693",
    appId: "1:892135666693:web:4f8bf849019603a937586c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const withdrawalsTableBody = document.getElementById('withdrawals-table-body');
const logoutBtn = document.getElementById('logout-btn');
const loadingSpinner = document.getElementById('loading-spinner');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');

async function fetchWithdrawals() {
    loadingSpinner.style.display = 'block';
    emptyState.style.display = 'none';
    withdrawalsTableBody.innerHTML = '';

    try {
        const withdrawalsCollection = collection(db, 'withdrawalRequests');
        const querySnapshot = await getDocs(withdrawalsCollection);

        let hasPendingWithdrawals = false;

        for (const withdrawalDoc of querySnapshot.docs) {
            const withdrawal = withdrawalDoc.data();
            const userId = withdrawal.userId;

            if (withdrawal.status === 'pending') {
                hasPendingWithdrawals = true;
                const userDoc = await getDoc(doc(db, 'users', userId));
                const user = userDoc.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.name || 'N/A'}</td>
                    <td>₹${withdrawal.amount || 0}</td>
                    <td>${withdrawal.fullName || 'N/A'}</td>
                    <td>${withdrawal.phoneNumber || 'N/A'}</td>
                    <td>${withdrawal.upiId || 'N/A'}</td>
                    <td><span class="status-${(withdrawal.status || 'unknown').toLowerCase()}">${withdrawal.status || 'Unknown'}</span></td>
                    <td>
                        <div class="action-buttons-container">
                            ${withdrawal.status === 'pending' ? `
                                <button class="action-btn approve-btn" data-withdrawal-id="${withdrawalDoc.id}">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="action-btn reject-btn" data-withdrawal-id="${withdrawalDoc.id}">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                `;
                withdrawalsTableBody.appendChild(row);
            }
        }

        if (!hasPendingWithdrawals) {
            emptyState.style.display = 'block';
        }

        document.querySelectorAll('.approve-btn').forEach(button => {
            button.addEventListener('click', () => handleWithdrawal(button.dataset.withdrawalId, 'approved'));
        });

        document.querySelectorAll('.reject-btn').forEach(button => {
            button.addEventListener('click', () => handleWithdrawal(button.dataset.withdrawalId, 'rejected'));
        });

    } catch (error) {
        console.error('Error fetching withdrawals:', error);
        // Optionally show an error message to the user
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

async function handleWithdrawal(withdrawalId, status) {
    const withdrawalRef = doc(db, 'withdrawalRequests', withdrawalId);
    try {
        await runTransaction(db, async (transaction) => {
            const withdrawalDoc = await transaction.get(withdrawalRef);
            if (!withdrawalDoc.exists()) {
                throw 'Withdrawal request does not exist!';
            }

            const withdrawalData = withdrawalDoc.data();
            const userId = withdrawalData.userId;
            const amount = withdrawalData.amount;

            // Read walletDoc here, before any writes
            const walletRef = doc(db, 'wallets', userId);
            const walletDoc = await transaction.get(walletRef);

            transaction.update(withdrawalRef, { status: status });

            if (status === 'rejected') {
                if (walletDoc.exists()) {
                    const currentBalance = walletDoc.data().balance || 0;
                    const newBalance = currentBalance + amount;
                    transaction.update(walletRef, { balance: newBalance });
                }
            }
        });
        fetchWithdrawals();
    } catch (error) {
        console.error('Error handling withdrawal:', error);
    }
}

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = '../login.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

refreshBtn.addEventListener('click', fetchWithdrawals);

fetchWithdrawals();