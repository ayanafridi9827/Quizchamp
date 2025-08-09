document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIG & INITIALIZATION ---
    const firebaseConfig = {
        apiKey: "AIzaSyBgCHdqzcsiB9VBTsv4O1fU2R88GVoOOyA",
        authDomain: "quizarena-c222d.firebaseapp.com",
        projectId: "quizarena-c222d",
        storageBucket: "quizarena-c222d.firebasestorage.app",
        messagingSenderId: "892135666693",
        appId: "1:892135666693:web:4f8bf849019603a937586c"
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- DOM ELEMENTS ---
    const getEl = (id) => document.getElementById(id);
    const ui = {
        referralCodeSpan: getEl('referral-code'),
        copyCodeBtn: getEl('copy-code-btn'),
        totalReferrals: getEl('total-referrals'),
        referralEarnings: getEl('referral-earnings'),
        notification: getEl('notification'),
        shareWhatsapp: document.querySelector('.share-btn.whatsapp'),
        shareTelegram: document.querySelector('.share-btn.telegram'),
        shareTwitter: document.querySelector('.share-btn.twitter'),
        shareFacebook: document.querySelector('.share-btn.facebook'),
        myReferralSection: getEl('my-referral-section'),
        friendReferralCodeInput: getEl('friend-referral-code-input'),
        submitFriendReferralBtn: getEl('submit-friend-referral-btn'),
        friendReferralErrorMessageDiv: getEl('friend-referral-error-message'),
    };

    // --- STATE ---
    let currentUser = null;
    let userReferralCode = '';

    // --- UTILITY FUNCTIONS ---
    function showNotification(message, type) {
        ui.notification.textContent = message;
        ui.notification.className = 'notification'; // Reset classes
        ui.notification.classList.add(type, 'show');
        setTimeout(() => {
            ui.notification.classList.remove('show');
        }, 3000);
    }

    function displayError(message, element) {
        if (element) {
            element.textContent = message;
        }
    }

    async function submitFriendReferralCode() {
        ui.submitFriendReferralBtn.disabled = true;
        displayError('', ui.friendReferralErrorMessageDiv);
        const code = ui.friendReferralCodeInput.value.trim().toUpperCase();

        if (!code || !currentUser) {
            displayError("Please enter a code and ensure you are logged in.", ui.friendReferralErrorMessageDiv);
            ui.submitFriendReferralBtn.disabled = false;
            return;
        }

        try {
            const currentUserReferralRef = db.collection('referrals').doc(currentUser.uid);
            const currentUserReferralDoc = await currentUserReferralRef.get();

            if (currentUserReferralDoc.exists && currentUserReferralDoc.data().referredBy) {
                displayError("You have already used a referral code.", ui.friendReferralErrorMessageDiv);
                return;
            }

            const referrerQuery = await db.collection('referrals').where('code', '==', code).limit(1).get();

            if (referrerQuery.empty) {
                displayError("Invalid referral code.", ui.friendReferralErrorMessageDiv);
                return;
            }

            const referrerDoc = referrerQuery.docs[0];
            const referrerId = referrerDoc.id;

            if (referrerId === currentUser.uid) {
                displayError("You cannot refer yourself.", ui.friendReferralErrorMessageDiv);
                return;
            }

            await db.runTransaction(async (transaction) => {
                const referrerRef = db.collection('referrals').doc(referrerId);
                const currentUserWalletRef = db.collection('wallets').doc(currentUser.uid);

                transaction.set(currentUserWalletRef, { 
                    balance: firebase.firestore.FieldValue.increment(10),
                    deposits: firebase.firestore.FieldValue.arrayUnion({
                        amount: 10,
                        timestamp: new Date(),
                        type: 'Referral Bonus',
                        description: 'Bonus for using a referral code'
                    })
                }, { merge: true });

                transaction.update(currentUserReferralRef, { referredBy: referrerId });
                transaction.update(referrerRef, { joined: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            });

            showNotification("Code applied! You received ₹10.", 'success');
            ui.friendReferralCodeInput.disabled = true;
            ui.submitFriendReferralBtn.style.display = 'none';

        } catch (error) {
            console.error("Error in referral transaction:", error);
            displayError("An error occurred. Please try again.", ui.friendReferralErrorMessageDiv);
        } finally {
            ui.submitFriendReferralBtn.disabled = false;
        }
    }

    async function updateReferralUI() {
        if (!currentUser) return;

        const referralRef = db.collection('referrals').doc(currentUser.uid);
        try {
            const referralDoc = await referralRef.get();
            if (referralDoc.exists) {
                const referralData = referralDoc.data();

                if (referralData.referredBy) {
                    const enterCodeSection = document.getElementById('enter-code-section');
                    if (enterCodeSection) {
                        enterCodeSection.style.display = 'none';
                    }
                }

                userReferralCode = referralData.code || '';
                const referralsCount = referralData.joined ? referralData.joined.length : 0;
                const referralEarnings = referralData.earnings || 0;

                ui.referralCodeSpan.textContent = userReferralCode;
                ui.totalReferrals.textContent = referralsCount;
                ui.referralEarnings.textContent = `₹${referralEarnings.toFixed(2)}`;

                ui.myReferralSection.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error fetching/generating referral data:", error);
            showNotification("Failed to load referral data.", 'error');
        }
    }

    // --- EVENT LISTENERS ---
    ui.copyCodeBtn.addEventListener('click', async () => {
        if (userReferralCode) {
            try {
                await navigator.clipboard.writeText(userReferralCode);
                showNotification("Referral code copied!", 'success');
            } catch (err) {
                console.error('Failed to copy: ', err);
                showNotification("Failed to copy code.", 'error');
            }
        }
    });

    ui.submitFriendReferralBtn.addEventListener('click', submitFriendReferralCode);

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            updateReferralUI();
            checkReferralRewards();
        } else {
            window.location.href = '/auth/login.html';
        }
    });

    async function checkReferralRewards() {
        if (!currentUser) return;

        const referrerRef = db.collection('referrals').doc(currentUser.uid);
        const referrerDoc = await referrerRef.get();

        if (referrerDoc.exists) {
            const referrerData = referrerDoc.data();
            const joinedUsers = referrerData.joined || []; // This now contains just UIDs

            for (const referredUserId of joinedUsers) {
                console.log("Processing referred user: ", referredUserId);

                const referredUserRef = db.collection('referrals').doc(referredUserId);
                const referredUserDoc = await referredUserRef.get();

                if (!referredUserDoc.exists) {
                    console.log("Referred user document does not exist: ", referredUserId);
                    continue;
                }

                const referredUserData = referredUserDoc.data();

            console.log(`Debug: referredUserData.hasJoinedContest = ${referredUserData.hasJoinedContest} for user ${referredUserId}`);
            console.log(`Debug: referredUserData.rewardGiven = ${referredUserData.rewardGiven} for user ${referredUserId}`);

            // Check if hasJoinedContest is true AND rewardGiven is not true
            if (referredUserData.hasJoinedContest && !referredUserData.rewardGiven) {
                console.log("User has joined contest and reward not yet given, processing reward for: ", referredUserId);
                try {
                    await db.runTransaction(async (transaction) => {
                        // Update referrer's earnings
                        transaction.update(referrerRef, {
                            earnings: firebase.firestore.FieldValue.increment(10)
                        });

                        // Update referrer's wallet
                        const referrerWalletRef = db.collection('wallets').doc(currentUser.uid);
                        transaction.update(referrerWalletRef, {
                            balance: firebase.firestore.FieldValue.increment(10)
                        });

                        // Mark reward as given in the referred user's document
                        transaction.update(referredUserRef, { rewardGiven: true });
                    });
                    console.log("Reward successfully processed and marked as given for: ", referredUserId);
                } catch (error) {
                    console.error("Error processing reward for ", referredUserId, ": ", error);
                }
            } else {
                console.log("Referred user has not joined contest or reward already given for: ", referredUserId);
            }
            }
            // After checking and updating, refresh the UI
            updateReferralUI();
        }
    }
});