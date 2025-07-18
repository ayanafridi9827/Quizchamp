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
    serverTimestamp,
    updateDoc,
    collection,
    query,
    where,
    getDocs
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

// Flag to prevent race conditions between sign-in and auth state changes
let isSigningIn = false;

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
    if (isSigningIn) return; // Prevent double-clicks
    isSigningIn = true;
    
    try {
        setLoading(true);
        const result = await signInWithPopup(auth, provider);
        console.log('Google Sign-In successful:', result.user);
        
        // Get challenge ID and redirect URL from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const challengeId = urlParams.get('challengeId');
        const redirectUrl = urlParams.get('redirect');
        const referrerCode = urlParams.get('ref'); // Get referral code from URL
        
        // Create/update user profile (write-only)
        await createOrUpdateUserProfile(result.user, challengeId, referrerCode);
        
        // Sidha home page par redirect karein. Baki logic home page par hai.
        if (challengeId) {
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
        isSigningIn = false; // Reset the flag
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

        // User ki saari jaankari ek hi object mein
        const initialUserData = {
            uid: user.uid,
            name: user.displayName || "No Name",
            email: user.email,
            photoURL: user.photoURL || '',
            lastLogin: serverTimestamp(),
            createdAt: serverTimestamp(),
            role: 'user',
            contests: [],
            
            
        };

        // setDoc with { merge: true } istemal karenge. 
        // Yeh document create karega, ya agar pehle se hai toh sirf lastLogin update karega.
        // Isse naye aur purane users, dono handle ho jayenge.
        await setDoc(userRef, {
            lastLogin: serverTimestamp(),
            name: user.displayName || "No Name",
            photoURL: user.photoURL || ''
        }, { merge: true });

        // Check if the document was just created to set initial data
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists || !userSnap.data().createdAt) {
            await setDoc(userRef, initialUserData, { merge: true });

            // Create initial wallet document
            const walletRef = doc(db, 'wallets', user.uid);
            await setDoc(walletRef, {
                userId: user.uid,
                balance: 0,
                deposits: [],
                withdraws: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log('Initial wallet created successfully.');

            // Create initial referral document
            const referralRef = doc(db, 'referrals', user.uid);
            const newReferralCode = generateReferralCode(user.uid);
            await setDoc(referralRef, {
                userId: user.uid,
                code: newReferralCode,
                referredBy: referrerCode || null, // Set referredBy if a referrerCode exists
                joined: [],
                earnings: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log('Initial referral document created successfully.');

            // If there's a referrer, update their 'joined' list
            if (referrerCode) {
                const referrerQuery = query(collection(db, 'referrals'), where('code', '==', referrerCode));
                const referrerSnapshot = await getDocs(referrerQuery);
                if (!referrerSnapshot.empty) {
                    const referrerDoc = referrerSnapshot.docs[0];
                    const referrerDocRef = doc(db, 'referrals', referrerDoc.id);
                    await updateDoc(referrerDocRef, {
                        joined: arrayUnion(user.uid),
                        updatedAt: serverTimestamp()
                    });
                    console.log(`Referrer ${referrerCode} updated with new joined user.`);
                } else {
                    console.warn(`Referrer with code ${referrerCode} not found.`);
                }
            }
        }

        console.log('User profile upserted successfully. Wallet and referral handled separately.');

    } catch (error) {
        console.error('Error in consolidated user profile creation:', error);
        throw error;
    }
}



// Add click event listener to the sign-in button
googleSignInButton.addEventListener('click', handleGoogleSignIn);