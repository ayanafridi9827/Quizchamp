// Mark that user is on admin pages
if (window.setOnAdminPage) {
    window.setOnAdminPage();
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration
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

// Check admin authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Check if user is admin in admins collection
            const adminRef = doc(db, 'admins', user.uid);
            const adminDoc = await getDoc(adminRef);
            
            if (!adminDoc.exists() || adminDoc.data().role !== 'admin') {
                console.log('User is not an admin, redirecting to login...');
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            window.location.href = 'login.html';
        }
    } else {
        console.log('No user logged in, redirecting to login...');
        window.location.href = 'login.html';
    }
});

// Logout functionality
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
        }
    });
} 