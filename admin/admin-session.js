// Mark that user is on admin pages
if (window.setOnAdminPage) {
    window.setOnAdminPage();
}

// Check authentication state
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const auth = getAuth();

// Only redirect to login if we're not already on the login page
const currentPage = window.location.pathname.split('/').pop();
if (currentPage !== 'login.html') {
    onAuthStateChanged(auth, (user) => {
        if (!user || user.email !== 'ayanafridi752@gmail.com') {
            // If not authenticated or not the correct email, redirect to login
            window.location.href = 'login.html';
        }
    });
} 