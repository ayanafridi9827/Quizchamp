// firebase.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
// If you use other Firebase services (Storage, Functions, etc.), import their 'get' functions here

// Your web app's Firebase configuration
// Replace with your actual project configuration
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
console.log('Firebase App initialized.');

// Get service instances
const auth = getAuth(app);
console.log('Firebase Auth service obtained.');

const db = getFirestore(app);
console.log('Firebase Firestore service obtained.');

// Optional: Enable Firestore offline persistence
// import { enablePersistence } from "firebase/firestore";
// try {
//   await enablePersistence(db);
//   console.log("Firestore persistence enabled");
// } catch (err) {
//   if (err.code === 'failed-precondition') {
//     console.warn("Firestore persistence failed: Multiple tabs open.");
//   } else if (err.code === 'unimplemented') {
//     console.warn("Firestore persistence failed: Browser not supported.");
//   } else {
//     console.error("Firestore persistence failed:", err);
//   }
// }

// Export the service instances for use in other files
export {
    auth,
    db,
    // Export other services if you initialized them (e.g., storage, functions)
}; 