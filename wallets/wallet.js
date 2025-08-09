import { auth, db } from '../firebase.js';
import { collection, doc, getDoc, runTransaction, serverTimestamp, arrayUnion, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const depositBtn = document.querySelector('.action-btn.deposit');
    const depositModal = document.getElementById('deposit-modal');
    const closeModalBtn = document.querySelector('.close-btn');
    const proceedToPayBtn = document.getElementById('proceed-to-pay');
    const depositAmountInput = document.getElementById('deposit-amount');

    const withdrawBtn = document.querySelector('.action-btn.withdraw');
    const withdrawModal = document.getElementById('withdraw-modal');
    const closeWithdrawModalBtn = withdrawModal.querySelector('.close-btn');
    const confirmWithdrawBtn = document.getElementById('confirm-withdraw');
    const withdrawAmountInput = document.getElementById('withdraw-amount');
        const notification = document.getElementById('notification');

    let currentUser = null;
    let balanceFetched = false;

    let totalReads = 0;
    let totalWrites = 0;

    function logFirestoreOperation(type, count = 1) {
        if (type === 'read') {
            totalReads += count;
        } else if (type === 'write') {
            totalWrites += count;
        }
    }

    // Function to show notifications
    function showNotification(message, type) {
        notification.textContent = message;
        notification.className = 'notification'; // Reset classes
        notification.classList.add(type, 'show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Function to render transaction history
    async function renderTransactionHistory(deposits, withdraws) {
        const transactionList = document.getElementById('transaction-list');
        transactionList.innerHTML = ''; // Clear existing rows

        const allTransactions = [];

        if (deposits) {
            deposits.forEach(deposit => {
                let type = deposit.type || 'Deposit';
                let description = deposit.description || (type === 'Referral' ? 'Referral Bonus' : 'Deposit');

                allTransactions.push({
                    date: deposit.timestamp ? new Date(deposit.timestamp.seconds * 1000) : new Date(),
                    description: description,
                    type: type,
                    amount: deposit.amount,
                    status: 'Completed'
                });
            });
        }

        // Fetch withdrawal requests
        const withdrawalRequestsCollection = collection(db, 'withdrawalRequests');
        const q = query(withdrawalRequestsCollection, where("userId", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            const withdrawal = doc.data();
            let displayStatus = withdrawal.status;
            if (withdrawal.status === 'approved') {
                displayStatus = 'Completed';
            } else if (withdrawal.status === 'rejected') {
                displayStatus = 'Failed';
            }
            allTransactions.push({
                date: withdrawal.timestamp ? new Date(withdrawal.timestamp.seconds * 1000) : new Date(),
                description: 'Withdrawal',
                type: 'Withdrawal',
                amount: withdrawal.amount,
                status: displayStatus
            });
        });


        // Sort transactions by date, newest first
        allTransactions.sort((a, b) => b.date - a.date);

        allTransactions.forEach(transaction => {
            const transactionItem = document.createElement('div');
            transactionItem.classList.add('transaction-item');
            if (transaction.type === 'Contest Prize') {
                transactionItem.classList.add('contest-prize-item');
            } else if (transaction.type === 'Referral') {
                transactionItem.classList.add('referral');
            } else if (transaction.type === 'Deposit') {
                transactionItem.classList.add('deposit-item');
            } else if (transaction.type === 'Withdrawal') {
                transactionItem.classList.add('withdrawal-item');
            }

            const transactionDetails = document.createElement('div');
            transactionDetails.classList.add('transaction-details');

            const description = document.createElement('span');
            description.classList.add('transaction-description');
            description.textContent = transaction.description;

            const date = document.createElement('span');
            date.classList.add('transaction-date');
            date.textContent = transaction.date.toLocaleDateString();

            transactionDetails.appendChild(description);
            transactionDetails.appendChild(date);

            const transactionAmount = document.createElement('div');
            transactionAmount.classList.add('transaction-amount');

            const amount = document.createElement('span');
            amount.textContent = `₹${transaction.amount.toFixed(2)}`;
            amount.classList.add(transaction.type === 'Deposit' ? 'deposit-amount' : 'withdraw-amount');

            const status = document.createElement('span');
            status.classList.add('transaction-status', `status-${transaction.status.toLowerCase()}`);
            status.textContent = transaction.status;

            transactionAmount.appendChild(amount);
            transactionAmount.appendChild(status);

            transactionItem.appendChild(transactionDetails);
            transactionItem.appendChild(transactionAmount);

            transactionList.appendChild(transactionItem);
        });
    }

    // Listen for auth state changes
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            // Fetch balance only if on wallet page
            if (window.location.pathname.includes('/wallets/wallet.html') && !balanceFetched) {
                balanceFetched = true; // Set the flag to true immediately
                const walletRef = doc(collection(db, 'wallets'), user.uid);
                try {
                    console.log('Firestore Read: Attempting to fetch wallet balance for user:', user.uid);
                    const doc = await getDoc(walletRef);
                    console.log('Firestore Read: Document snapshot received.', doc.exists ? 'Document exists.' : 'Document does not exist.');
                    const balanceAmountEl = document.querySelector('.balance-amount');
                    if (doc.exists) {
                        const data = doc.data();
                    if (data) {
                        const balance = data.balance || 0;
                        balanceAmountEl.textContent = `₹${balance.toFixed(2)}`;
                        renderTransactionHistory(data.deposits || [], data.withdraws || []);
                    } else {
                        balanceAmountEl.textContent = '₹0.00';
                        renderTransactionHistory([], []);
                    }
                    } else {
                        balanceAmountEl.textContent = '₹0.00';
                        renderTransactionHistory([], []);
                    }
                } catch (error) {
                    console.error("Error fetching wallet balance:", error);
                    document.querySelector('.balance-amount').textContent = 'Error';
                }
            }
        } else {
            currentUser = null;
            window.location.href = '/auth/login.html';
        }
    });

    // Show the deposit modal
    depositBtn.addEventListener('click', () => {
        if (!currentUser) {
            showNotification("Please log in to deposit money.", 'error');
            return;
        }
        depositModal.style.display = 'flex';
    });

    // Hide the deposit modal
    closeModalBtn.addEventListener('click', () => {
        depositModal.style.display = 'none';
    });

    // Hide the modal if clicked outside the content
    window.addEventListener('click', (event) => {
        if (event.target === depositModal) {
            depositModal.style.display = 'none';
        }
        if (event.target === withdrawModal) {
            withdrawModal.style.display = 'none';
        }
    });

    // Show the withdraw modal
    withdrawBtn.addEventListener('click', () => {
        if (!currentUser) {
            showNotification("Please log in to withdraw money.", 'error');
            return;
        }
        withdrawModal.style.display = 'flex';
    });

    // Hide the withdraw modal
    closeWithdrawModalBtn.addEventListener('click', () => {
        withdrawModal.style.display = 'none';
    });

    // Handle the payment process
    proceedToPayBtn.addEventListener('click', () => {
        const amount = Number(depositAmountInput.value);

        if (isNaN(amount) || amount < 50) {
            showNotification('Minimum deposit amount is ₹50.', 'error');
            return;
        }

        const options = {
            key: 'rzp_live_HjqSvP0nYgJEOE',
            amount: amount * 100,
            currency: 'INR',
            name: 'QuizChamp',
            description: 'Deposit to your wallet',
            handler: async function (response) {
                let newBalance = 0;
                try {
                const walletRef = doc(collection(db, 'wallets'), currentUser.uid);
                    await runTransaction(db, async (transaction) => {
                        const walletDoc = await transaction.get(walletRef);
                        let currentBalance = 0;
                        if (walletDoc.exists) {
                            currentBalance = walletDoc.data().balance || 0;
                        }
                        newBalance = currentBalance + amount;
                transaction.set(walletRef, { 
                            balance: newBalance,
                            deposits: arrayUnion({
                                amount: amount,
                                timestamp: new Date(),
                                type: 'Deposit',
                                description: 'Deposit'
                            }),
                            lastTransaction: serverTimestamp()
                        }, { merge: true });
                    });
                    showNotification('Payment successful!', 'success');
                    depositModal.style.display = 'none';
                    document.querySelector('.balance-amount').textContent = `₹${newBalance.toFixed(2)}`;
                } catch (error) {
                    console.error("Error updating wallet balance: ", error);
                    showNotification("Failed to update wallet balance.", 'error');
                }
            },
            prefill: {
                name: currentUser.displayName || '',
                email: currentUser.email || '',
            },
            theme: {
                color: '#e43f5a'
            }
        };

        const rzp = new Razorpay(options);
        rzp.open();
    });

    // Handle withdraw process
    confirmWithdrawBtn.addEventListener('click', async () => {
        const amount = Number(withdrawAmountInput.value);
        const fullName = document.getElementById('full-name').value;
        const phoneNumber = document.getElementById('phone-number').value;
        const upiId = document.getElementById('upi-id').value;

        if (isNaN(amount) || amount <= 0) {
            showNotification('Please enter a valid amount to withdraw.', 'error');
            return;
        }

        if (!fullName || !phoneNumber || !upiId) {
            showNotification('Please fill in all the fields.', 'error');
            return;
        }

        // Basic validation for Indian phone number
        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(phoneNumber)) {
            showNotification('Please enter a valid Indian phone number.', 'error');
            return;
        }

        if (!currentUser) {
            showNotification("User not logged in.", 'error');
            return;
        }

        const walletRef = doc(collection(db, 'wallets'), currentUser.uid);
        const withdrawalRef = doc(collection(db, 'withdrawalRequests'));

        try {
            let newBalance = 0;
            await runTransaction(db, async (transaction) => {
                const walletDoc = await transaction.get(walletRef);
                let currentBalance = 0;
                if (walletDoc.exists) {
                    currentBalance = walletDoc.data().balance || 0;
                }

                if (amount > currentBalance) {
                    showNotification('Insufficient balance.', 'error');
                    throw new Error("Insufficient balance");
                }

                newBalance = currentBalance - amount;
                const withdrawRequest = {
                    userId: currentUser.uid,
                    amount: amount,
                    fullName: fullName,
                    phoneNumber: phoneNumber,
                    upiId: upiId,
                    status: 'pending',
                    timestamp: serverTimestamp()
                };

                transaction.set(withdrawalRef, withdrawRequest);
                transaction.update(walletRef, { balance: newBalance });
            });
            showNotification('Withdraw request submitted successfully!', 'success');
            withdrawModal.style.display = 'none';
            // Update balance display
            document.querySelector('.balance-amount').textContent = `₹${newBalance.toFixed(2)}`;
        } catch (error) {
            console.error("Error submitting withdraw request: ", error);
            if (error.message !== "Insufficient balance") {
                showNotification("Failed to submit withdraw request.", 'error');
            }
        }
    });

    // Mobile menu toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const overlay = document.querySelector('.overlay');

    if (mobileMenuBtn && navLinks && overlay) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            navLinks.classList.remove('active');
            overlay.classList.remove('active');
        });

        // Close menu when a nav link is clicked
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                overlay.classList.remove('active');
            });
        });
    }
});