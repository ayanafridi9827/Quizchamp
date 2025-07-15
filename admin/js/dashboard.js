import { getFirestore, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { db } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard script loaded. Fetching data...");

    try {
        // Fetch total users
        const usersCollection = collection(db, "users");
        const usersSnapshot = await getDocs(usersCollection);
        document.getElementById('users-count').innerText = usersSnapshot.size;
        console.log(`Found ${usersSnapshot.size} users.`);

        // Fetch total quizzes
        const quizzesCollection = collection(db, "quiz");
        const quizzesSnapshot = await getDocs(quizzesCollection);
        document.getElementById('quizzes-count').innerText = quizzesSnapshot.size;
        console.log(`Found ${quizzesSnapshot.size} quizzes.`);

        // Fetch total challenges
        const challengesCollection = collection(db, "contests");
        const challengesSnapshot = await getDocs(challengesCollection);
        document.getElementById('challenges-count').innerText = challengesSnapshot.size;
        console.log(`Found ${challengesSnapshot.size} challenges.`);

        // Fetch pending withdrawals
        const withdrawalsCollection = collection(db, "withdrawalRequests");
        const pendingWithdrawalsQuery = query(withdrawalsCollection, where("status", "==", "pending"));
        const withdrawalsSnapshot = await getDocs(pendingWithdrawalsQuery);
        document.getElementById('withdrawals-count').innerText = withdrawalsSnapshot.size;
        console.log(`Found ${withdrawalsSnapshot.size} pending withdrawals.`);

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        // Optionally display an error message to the user on the dashboard
        document.getElementById('users-count').innerText = 'Error';
        document.getElementById('quizzes-count').innerText = 'Error';
        document.getElementById('challenges-count').innerText = 'Error';
        document.getElementById('withdrawals-count').innerText = 'Error';
    }
});
