import { 
    GoogleAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Get Firebase services from window object, assuming they are initialized in the HTML
const auth = window.auth;
const db = window.db;

// Initialize Google Auth Provider
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
    prompt: 'select_account'
});

const googleSignInButton = document.getElementById('googleSignIn');
let isSigningIn = false;

function setLoading(isLoading) {
    if (isLoading) {
        googleSignInButton.classList.add('loading');
        googleSignInButton.disabled = true;
    } else {
        googleSignInButton.classList.remove('loading');
        googleSignInButton.disabled = false;
    }
}

// Simple referral code generator
function generateReferralCode(uid) {
    return uid.substring(0, 4).toUpperCase() + Math.random().toString(36).substring(2, 4).toUpperCase();
}

/**
 * Checks if a user profile exists. If not, creates a full profile with a wallet and referral code.
 * If the user exists, it just updates their last login time.
 * @param {object} user The Firebase auth user object.
 */
async function createOrUpdateUserProfile(user) {
    const userRef = doc(db, "users", user.uid);
    try {
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            // --- This is a NEW user ---
            console.log("New user detected. Creating full profile...");

            // 1. Create User Document (without referral fields)
            await setDoc(userRef, {
                uid: user.uid,
                name: user.displayName || "Quiz Player",
                email: user.email,
                photoURL: user.photoURL || '',
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                role: 'user',
                contests: []
            });
            console.log("User document created.");

            // 2. Create Wallet Document
            const walletRef = doc(db, "wallets", user.uid);
            await setDoc(walletRef, {
                userId: user.uid,
                balance: 0,
                deposits: [],
                withdraws: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log("Wallet document created.");

            // 3. Create Referral Document (with all referral fields)
            const referralRef = doc(db, "referrals", user.uid);
            const newReferralCode = generateReferralCode(user.uid);
            await setDoc(referralRef, {
                userId: user.uid,
                code: newReferralCode,
                joined: [],
                earnings: 0,
                referredBy: null,
                hasJoinedContest: false, // <--- ADD THIS LINE
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log("Referral document created.");

        } else {
            // --- This is a RETURNING user ---
            console.log("Returning user detected. Updating last login.");
            await updateDoc(userRef, {
                lastLogin: serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Error in createOrUpdateUserProfile: ", error);
        throw error; // Re-throw the error to be caught by the caller
    }
}

async function handleGoogleSignIn() {
    if (isSigningIn) return;
    isSigningIn = true;
    setLoading(true);
    
    try {
        const result = await signInWithPopup(auth, provider);
        console.log('Google Sign-In successful:', result.user);
        
        await createOrUpdateUserProfile(result.user);
        
        // Redirect after profile creation/update
        const urlParams = new URLSearchParams(window.location.search);
        const challengeId = urlParams.get('challengeId');
        const redirectUrl = urlParams.get('redirect');
        
        if (challengeId) {
            window.location.href = `/Home/home.html?challengeId=${challengeId}`;
        } else if (redirectUrl) {
            window.location.href = `/Home/${redirectUrl}.html`;
        } else {
            window.location.href = '/Home/home.html';
        }

    } catch (error) {
        console.error('Error during Google Sign-In:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = `Sign-in failed: ${error.message}`;
        document.querySelector('.login-box').insertBefore(errorMessage, document.querySelector('.terms'));
        setTimeout(() => errorMessage.remove(), 5000);
    } finally {
        setLoading(false);
        isSigningIn = false;
    }
}

googleSignInButton.addEventListener('click', handleGoogleSignIn);
