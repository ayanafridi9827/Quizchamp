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
    const REFERRAL_BONUS_AMOUNT_PASTER = 10; // Bonus for the user who pastes the code
    const REFERRAL_BONUS_AMOUNT_REFERRER = 20; // Bonus for the referrer

    // --- UTILITY FUNCTIONS ---
    function showNotification(message, type) {
        ui.notification.textContent = message;
        ui.notification.className = 'notification'; // Reset classes
        ui.notification.classList.add(type, 'show');
        setTimeout(() => {
            ui.notification.classList.remove('show');
        }, 3000);
    }

    function generateReferralCode(uid) {
        return btoa(uid).slice(0, 6).replace(/=/g, '').toUpperCase();
    }

    function displayError(message, element) {
        if (element) {
            element.textContent = message;
        } else {
            // Fallback to a default error display if no element is provided
            console.error("Error: " + message);
        }
    }

    async function submitFriendReferralCode() {
        // Disable the button to prevent multiple clicks
        ui.submitFriendReferralBtn.disabled = true;

        displayError('', ui.friendReferralErrorMessageDiv); // Clear previous errors
        const code = ui.friendReferralCodeInput.value.trim().toUpperCase();

        if (!code) {
            displayError("Please enter a referral code.", ui.friendReferralErrorMessageDiv);
            ui.submitFriendReferralBtn.disabled = false; // Re-enable on error
            return;
        }

        if (!currentUser) {
            showNotification("You must be logged in to submit a referral code.", 'error');
            ui.submitFriendReferralBtn.disabled = false; // Re-enable on error
            return;
        }

        // Force refresh of ID token to ensure it's current
        await currentUser.getIdToken(true);

        // Prevent self-referral
        const currentUserReferralRef = db.collection('referrals').doc(currentUser.uid);
        const currentUserReferralSnap = await currentUserReferralRef.get();
        if (currentUserReferralSnap.exists && currentUserReferralSnap.data().code === code) {
            displayError("You cannot refer yourself.", ui.friendReferralErrorMessageDiv);
            ui.submitFriendReferralBtn.disabled = false; // Re-enable on error
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
                    // This case should ideally not happen if login.js works correctly
                    // But as a fallback, create the referral doc for the current user
                    const newReferralCode = btoa(currentUser.uid).slice(0, 6).replace(/=/g, '').toUpperCase();
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

                const referrerRef = db.collection('referrals').doc(referrerUid);
                const referrerWalletRef = db.collection('wallets').doc(referrerUid);

                await db.runTransaction(async (transaction) => {
                    // All reads first
                    const currentReferrerDoc = await transaction.get(referrerRef);
                    const referrerWalletDoc = await transaction.get(referrerWalletRef);
                    const currentUserWalletRef = db.collection('wallets').doc(currentUser.uid); // Current user's wallet
                    const currentUserWalletDoc = await transaction.get(currentUserWalletRef);

                    // Then all writes
                    if (currentReferrerDoc.exists) {
                        transaction.update(referrerRef, { 
                            joined: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                            earnings: firebase.firestore.FieldValue.increment(15) // Referrer gets 15rs
                        });
                    }

                    let currentReferrerBalance = 0;
                    if (referrerWalletDoc.exists) {
                        currentReferrerBalance = referrerWalletDoc.data().balance || 0;
                    }
                    const newReferrerBalance = currentReferrerBalance + 15;
                    transaction.set(referrerWalletRef, {
                        balance: newReferrerBalance,
                        deposits: firebase.firestore.FieldValue.arrayUnion({
                            amount: 15,
                            timestamp: new Date(),
                            type: 'Referral Bonus Earned'
                        }),
                        lastTransaction: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                    // Update current user's wallet with bonus
                    let currentUserBalance = 0;
                    if (currentUserWalletDoc.exists) {
                        currentUserBalance = currentUserWalletDoc.data().balance || 0;
                    }
                    const newCurrentUserBalance = currentUserBalance + 10;
                    transaction.set(currentUserWalletRef, {
                        balance: newCurrentUserBalance,
                        deposits: firebase.firestore.FieldValue.arrayUnion({
                            amount: 10,
                            timestamp: new Date(),
                            type: 'Referral Bonus Received'
                        }),
                        lastTransaction: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                });

                showNotification(`Referral code applied successfully! You received ₹${REFERRAL_BONUS_AMOUNT_PASTER} and your friend received ₹${REFERRAL_BONUS_AMOUNT_REFERRER}!`, 'success');
                updateReferralUI(); // Refresh UI to show updated earnings

            } else {
                displayError("Invalid referral code. Please check and try again.", ui.friendReferralErrorMessageDiv);
                ui.submitFriendReferralBtn.disabled = false; // Re-enable on error
            }
        } catch (error) {
            console.error("Error submitting friend's referral code:", error);
            displayError("An error occurred. Please try again.", ui.friendReferralErrorMessageDiv);
            ui.submitFriendReferralBtn.disabled = false; // Re-enable on error
        }
    }

    async function updateReferralUI() {
        if (!currentUser) return;

        const referralRef = db.collection('referrals').doc(currentUser.uid);
        try {
            const referralDoc = await referralRef.get();
            if (referralDoc.exists) {
                const referralData = referralDoc.data();

                // Check if the user has already been referred by someone
                if (referralData.referredBy) {
                    // Hide the section for entering a friend's code
                    const enterCodeSection = document.getElementById('enter-code-section');
                    if (enterCodeSection) {
                        enterCodeSection.style.display = 'none';
                    }
                } else {
                    // Show the section if they haven't been referred yet
                    const enterCodeSection = document.getElementById('enter-code-section');
                    if (enterCodeSection) {
                        enterCodeSection.style.display = 'block';
                    }
                }

                userReferralCode = referralData.code || '';
                const referralsCount = referralData.joined ? referralData.joined.length : 0;
                const referralEarnings = referralData.earnings || 0;

                ui.referralCodeSpan.textContent = userReferralCode;
                ui.totalReferrals.textContent = referralsCount;
                ui.referralEarnings.textContent = `₹${referralEarnings.toFixed(2)}`;

                ui.myReferralSection.classList.remove('hidden');
            } else {
                // User has no referral code yet, keep myReferralSection hidden
                ui.myReferralSection.classList.add('hidden');
                ui.referralCodeSpan.textContent = 'N/A'; // Clear previous code
                ui.totalReferrals.textContent = '0';
                ui.referralEarnings.textContent = '₹0.00';
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
        } else {
            showNotification("No referral code to copy.", 'error');
        }
    });

    // Submit friend's referral code (always visible now)
    ui.submitFriendReferralBtn.addEventListener('click', submitFriendReferralCode);

    // Share button logic
    const shareMessage = (platform) => {
        if (!userReferralCode) {
            showNotification("Referral code not available yet.", 'error');
            return;
        }
        const text = `Join QuizChamp using my referral code: ${userReferralCode} and get a bonus!`;
        const url = window.location.origin; // Or a specific app download link
        let shareLink = '';

        switch (platform) {
            case 'whatsapp':
                shareLink = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
                break;
            case 'telegram':
                shareLink = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
                break;
            case 'twitter':
                shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                break;
            case 'facebook':
                shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
                break;
            default:
                return;
        }
        window.open(shareLink, '_blank');
    };

    ui.shareWhatsapp.addEventListener('click', () => shareMessage('whatsapp'));
    ui.shareTelegram.addEventListener('click', () => shareMessage('telegram'));
    ui.shareTwitter.addEventListener('click', () => shareMessage('twitter'));
    ui.shareFacebook.addEventListener('click', () => shareMessage('facebook'));

    // The generateCodeBtn is removed from HTML, so its listener is no longer needed.

    // --- AUTH STATE LISTENER ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            updateReferralUI();
        } else {
            window.location.href = '/auth/login.html';
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