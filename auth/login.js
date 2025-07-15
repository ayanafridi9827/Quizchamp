import { 
    GoogleAuthProvider, 
    signInWithPopup,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc,
    arrayUnion,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Get Firebase services from window object
const auth = window.auth;
const db = window.db;

// Initialize Google Auth Provider with account selection
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
    prompt: 'select_account' // This forces the account selection popup
});

// Get the sign-in button
const googleSignInButton = document.getElementById('googleSignIn');

// Add loading state to button
function setLoading(isLoading) {
    if (isLoading) {
        googleSignInButton.classList.add('loading');
        googleSignInButton.disabled = true;
    } else {
        googleSignInButton.classList.remove('loading');
        googleSignInButton.disabled = false;
    }
}

// Handle Google Sign In
async function handleGoogleSignIn() {
    try {
        setLoading(true);
        const result = await signInWithPopup(auth, provider);
        console.log('Google Sign-In successful:', result.user);
        
        // Get challenge ID and redirect URL from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const challengeId = urlParams.get('challengeId');
        const redirectUrl = urlParams.get('redirect');
        const referrerCode = urlParams.get('ref'); // Get referral code from URL
        
        // Create/update user profile and handle challenge joining if needed
        await createOrUpdateUserProfile(result.user, challengeId, referrerCode);
        
        // After successful login/signup, check if user needs to enter a referral code
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        const userData = userDoc.data();

        if (!userData.referredBy && !referrerCode) {
            // User is new and was not referred via URL, redirect to referral entry page
            window.location.href = '/auth/enter-referral-code.html';
        } else if (challengeId) {
            window.location.href = `/Home/home.html?challengeId=${challengeId}`;
        } else if (redirectUrl) {
            window.location.href = `/Home/${redirectUrl}.html`;
        } else {
            window.location.href = '/Home/home.html';
        }
    } catch (error) {
        console.error('Error during Google Sign-In:', error);
        // Show error message to user
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = error.message;
        document.querySelector('.login-box').insertBefore(errorMessage, document.querySelector('.terms'));
        setTimeout(() => errorMessage.remove(), 5000);
    } finally {
        setLoading(false);
    }
}

// Function to generate a simple referral code
function generateReferralCode(uid) {
    return btoa(uid).slice(0, 6).replace(/=/g, '').toUpperCase();
}

// Create or update user profile in Firestore
async function createOrUpdateUserProfile(user, challengeId = null, referrerCode = null) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        const userData = {
            uid: user.uid,
            name: user.displayName || "No Name",
            email: user.email,
            photoURL: user.photoURL || '',
            lastLogin: new Date().toISOString(),
            role: 'user'
        };

        if (!userSnap.exists()) {
            // Create new user profile with all required fields
            const initialData = {
                ...userData,
                createdAt: new Date().toISOString(),
                
                // Arrays and collections
                contests: [],
            };

            // If there's a challenge ID, add it to history
            if (challengeId) {
                initialData.challengeHistory.push({
                    challengeId: challengeId,
                    joinedAt: new Date().toISOString(),
                    status: 'joined',
                    score: 0,
                    rewardEarned: 0
                });
                initialData.totalChallengesJoined = 1;
            }

            await setDoc(userRef, initialData);
            console.log('New user profile created successfully with all required fields');
            
            // Ensure wallet and referral entry are created for new users
            await createWalletAndReferralEntry(user);

            // Handle referrer if code is present
            if (referrerCode) {
                try {
                    const referrerQuery = await db.collection('referrals').where('code', '==', referrerCode).limit(1).get();
                    if (!referrerQuery.empty) {
                        const referrerDoc = referrerQuery.docs[0];
                        const referrerUid = referrerDoc.id;
                        
                        // Update referrer's joined array
                        const referrerRef = doc(db, 'referrals', referrerUid);
                        await runTransaction(db, async (transaction) => {
                            const currentReferrerDoc = await transaction.get(referrerRef);
                            if (currentReferrerDoc.exists) {
                                transaction.update(referrerRef, { joined: arrayUnion(user.uid) });
                            }
                        });
                        console.log(`Referral count incremented for referrer: ${referrerUid}`);
                    } else {
                        console.warn(`Referrer code ${referrerCode} not found in referrals collection.`);
                    }
                } catch (error) {
                    console.error("Error handling referrer:", error);
                }
            }

        } else {
            // Update existing user profile with only the necessary fields
            await setDoc(userRef, userData, { merge: true });
            console.log('Existing user profile updated successfully');
            
            // Ensure wallet and referral entry exist for existing users too
            await createWalletAndReferralEntry(user);
        }
    } catch (error) {
        console.error('Error creating/updating user profile:', error);
        throw error;
    }
}

// New function to create wallet and referral entry if they don't exist
async function createWalletAndReferralEntry(user) {
    // Create initial wallet for the user if it doesn't exist
    const walletRef = doc(db, 'wallets', user.uid);
    const walletSnap = await getDoc(walletRef);
    if (!walletSnap.exists()) {
        await setDoc(walletRef, {
            balance: 0,
            deposits: [],
            withdraws: [],
            createdAt: new Date().toISOString()
        });
        console.log('Initial wallet created for user.');
    }

    // Create initial referral entry for the user if it doesn't exist
    const referralRef = doc(db, 'referrals', user.uid);
    const referralSnap = await getDoc(referralRef);
    if (!referralSnap.exists()) {
        const newReferralCode = generateReferralCode(user.uid);
        await setDoc(referralRef, {
            code: newReferralCode,
            referredBy: null,
            joined: [],
            earnings: 0,
            createdAt: new Date().toISOString()
        });
        console.log('Initial referral entry created for user.');
    }
}

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Update last login time and ensure wallet/referral exist
            await createOrUpdateUserProfile(user);
        } catch (error) {
            console.error('Error updating user profile:', error);
        }
    }
});

// Add click event listener to the sign-in button
googleSignInButton.addEventListener('click', handleGoogleSignIn);