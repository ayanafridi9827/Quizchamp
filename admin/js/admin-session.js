import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore,
    doc,
    setDoc,
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

// Check if user is admin
async function checkAdminStatus(user) {
    if (!user) return false;
    
    try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        if (!adminDoc.exists()) {
            // Create admin document if it doesn't exist
            await setDoc(doc(db, 'admins', user.uid), {
                email: user.email,
                role: 'admin',
                createdAt: new Date().toISOString()
            });
            return true;
        }
        return true;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

// Check authentication and admin status
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const isAdmin = await checkAdminStatus(user);
        if (!isAdmin) {
            console.error('User is not an admin');
            window.location.href = '../login.html';
        }
    } else {
        window.location.href = '../login.html';
    }
}); 