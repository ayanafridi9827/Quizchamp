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
        
        // Create/update user profile and handle challenge joining if needed
        await createOrUpdateUserProfile(result.user, challengeId);
        
        // Redirect to appropriate page
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
    }
}

// Create or update user profile in Firestore
async function createOrUpdateUserProfile(user, challengeId = null) {
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
                
                // Challenge-related fields
                walletBalance: 0,
                totalChallengesJoined: 0,
                totalChallengesWon: 0,
                totalChallengesLost: 0,
                totalChallengeScore: 0,
                
                // Arrays and collections
                challengeHistory: [],
                achievements: [],
                
                // User progression
                currentLevel: 1,
                
                // Additional fields for future use
                preferences: {
                    notifications: true,
                    theme: 'light',
                    language: 'en'
                },
                
                // Social features
                friends: [],
                followers: [],
                following: []
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
        } else {
            // Update existing user profile with only the necessary fields
            await setDoc(userRef, userData, { merge: true });
            console.log('Existing user profile updated successfully');
        }
    } catch (error) {
        console.error('Error creating/updating user profile:', error);
        throw error;
    }
}

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Update last login time
            await createOrUpdateUserProfile(user);
        } catch (error) {
            console.error('Error updating user profile:', error);
        }
    }
});

// Add click event listener to the sign-in button
googleSignInButton.addEventListener('click', handleGoogleSignIn);
