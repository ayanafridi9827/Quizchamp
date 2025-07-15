// Mark that user is on admin pages
if (window.setOnAdminPage) {
    window.setOnAdminPage();
}

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from './js/firebase-config.js';

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