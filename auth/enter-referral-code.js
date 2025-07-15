document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIG & INITIALIZATION ---
    const REFERRAL_BONUS_AMOUNT = 10; // Define your bonus amount here
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
    const referralCodeInput = document.getElementById('referral-code-input');
    const submitReferralBtn = document.getElementById('submit-referral-btn');
    const skipReferralLink = document.getElementById('skip-referral-link');
    const errorMessageDiv = document.getElementById('error-message');
    const notification = document.getElementById('notification');

    // --- STATE ---
    let currentUser = null;

    // --- UTILITY FUNCTIONS ---
    function showNotification(message, type) {
        notification.textContent = message;
        notification.className = 'notification'; // Reset classes
        notification.classList.add(type, 'show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    function displayError(message) {
        errorMessageDiv.textContent = message;
    }

    async function submitReferralCode() {
        displayError(''); // Clear previous errors
        const code = referralCodeInput.value.trim().toUpperCase();

        if (!code) {
            displayError("Please enter a referral code.");
            return;
        }

        if (!currentUser) {
            showNotification("You must be logged in to submit a referral code.", 'error');
            return;
        }

        // Prevent self-referral
        const currentUserReferralRef = db.collection('referrals').doc(currentUser.uid);
        const currentUserReferralSnap = await currentUserReferralRef.get();
        if (currentUserReferralSnap.exists && currentUserReferralSnap.data().code === code) {
            displayError("You cannot refer yourself.");
            return;
        }

        try {
            // Find the referrer's UID by their referral code in the 'referrals' collection
            const referrerQuery = await db.collection('referrals').where('code', '==', code).limit(1).get();

            if (!referrerQuery.empty) {
                const referrerDoc = referrerQuery.docs[0];
                const referrerUid = referrerDoc.id;

                // Ensure current user's referral document exists before updating
                if (!currentUserReferralSnap.exists) {
                    // Generate code for current user if not already done
                    const newReferralCode = generateReferralCode(currentUser.uid);
                    await currentUserReferralRef.set({
                        code: newReferralCode,
                        referredBy: referrerUid,
                        joined: [],
                        earnings: 0,
                        createdAt: new Date().toISOString()
                    });
                } else {
                    // Update current user's referral document with referredBy
                    await currentUserReferralRef.update({ referredBy: referrerUid });
                }

                // Add current user to referrer's 'joined' array in a transaction
                const referrerRef = db.collection('referrals').doc(referrerUid);
                const referrerWalletRef = db.collection('wallets').doc(referrerUid); // Referrer's wallet

                await db.runTransaction(async (transaction) => {
                    const currentReferrerDoc = await transaction.get(referrerRef);
                    if (currentReferrerDoc.exists) {
                        transaction.update(referrerRef, { 
                            joined: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                            earnings: firebase.firestore.FieldValue.increment(REFERRAL_BONUS_AMOUNT) // Increment earnings
                        });
                    }

                    // Update referrer's wallet with bonus
                    const referrerWalletDoc = await transaction.get(referrerWalletRef);
                    let currentReferrerBalance = 0;
                    if (referrerWalletDoc.exists) {
                        currentReferrerBalance = referrerWalletDoc.data().balance || 0;
                    }
                    const newReferrerBalance = currentReferrerBalance + REFERRAL_BONUS_AMOUNT;
                    transaction.set(referrerWalletRef, {
                        balance: newReferrerBalance,
                        deposits: firebase.firestore.FieldValue.arrayUnion({
                            amount: REFERRAL_BONUS_AMOUNT,
                            timestamp: new Date(),
                            type: 'Referral Bonus'
                        }),
                        lastTransaction: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                });

                showNotification("Referral code applied successfully!", 'success');
                setTimeout(() => {
                    window.location.href = '/Home/home.html';
                }, 1000);

            } else {
                displayError("Invalid referral code. Please check and try again.");
            }
        } catch (error) {
            console.error("Error submitting referral code:", error);
            displayError("An error occurred. Please try again.");
        }
    }

    function skipReferral() {
        // Mark user as having skipped referral to avoid showing this page again
        if (currentUser) {
            const userReferralRef = db.collection('referrals').doc(currentUser.uid);
            userReferralRef.update({ skippedReferral: true })
                .then(() => {
                    console.log("User skipped referral and marked in Firestore.");
                    window.location.href = '/Home/home.html';
                })
                .catch(error => {
                    console.error("Error marking skipped referral:", error);
                    window.location.href = '/Home/home.html'; // Redirect even on error
                });
        } else {
            window.location.href = '/Home/home.html';
        }
    }

    // --- EVENT LISTENERS ---
    submitReferralBtn.addEventListener('click', submitReferralCode);
    skipReferralLink.addEventListener('click', skipReferral);

    // --- AUTH STATE LISTENER ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            // Check if user already has a referrer or has skipped
            const userReferralRef = db.collection('referrals').doc(currentUser.uid);
            try {
                const userReferralDoc = await userReferralRef.get();
                if (userReferralDoc.exists) {
                    const referralData = userReferralDoc.data();
                    if (referralData.referredBy || referralData.skippedReferral) {
                        // User already has a referrer or has skipped, redirect to home
                        window.location.href = '/Home/home.html';
                    }
                } else {
                    // If referral document doesn't exist, it means user is new and needs to create one
                    // This case should ideally be handled by login.js creating the initial referral doc
                    // For now, allow them to stay on this page to enter code
                }
            } catch (error) {
                console.error("Error checking user referral status:", error);
                // Continue to page even if error, to allow manual entry
            }
        } else {
            window.location.href = '/auth/login.html';
        }
    });
});