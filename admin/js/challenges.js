import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// DOM Elements
const addChallengeBtn = document.getElementById('add-challenge-btn');
const addChallengeModal = document.getElementById('add-challenge-modal');
const addChallengeForm = document.getElementById('add-challenge-form');
const closeModalBtn = document.getElementById('close-modal');
const challengesGrid = document.getElementById('challenges-grid');
const logoutBtn = document.getElementById('logout-btn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Show toast notification
function showToast(message, type = 'success') {
    toast.className = `toast ${type}`;
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Format date for display
function formatDate(date) {
    return new Date(date).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

// Calculate challenge status
function calculateStatus(startTime, endTime) {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (now < start) {
        return 'upcoming';
    } else if (now >= start && now <= end) {
        return 'ongoing';
    } else {
        return 'ended';
    }
}

// Create challenge card
function createChallengeCard(challenge) {
    const card = document.createElement('div');
    card.className = 'challenge-card';
    
    const status = calculateStatus(challenge.startTime, challenge.endTime);
    
    card.innerHTML = `
        <div class="challenge-header">
            <div>
                <h3 class="challenge-title">${challenge.title}</h3>
                <span class="challenge-subject">${challenge.subject}</span>
            </div>
            <span class="challenge-status status-${status}">${status}</span>
        </div>
        <div class="challenge-details">
            <div class="challenge-detail">
                <span class="challenge-detail-label">Entry Fee</span>
                <span class="challenge-detail-value">₹${challenge.entryFee}</span>
            </div>
            <div class="challenge-detail">
                <span class="challenge-detail-label">Prize</span>
                <span class="challenge-detail-value">₹${challenge.prize}</span>
            </div>
            <div class="challenge-detail">
                <span class="challenge-detail-label">Start Time</span>
                <span class="challenge-detail-value">${formatDate(challenge.startTime)}</span>
            </div>
            <div class="challenge-detail">
                <span class="challenge-detail-label">End Time</span>
                <span class="challenge-detail-value">${formatDate(challenge.endTime)}</span>
            </div>
        </div>
        <div class="challenge-footer">
            <div class="participants-count">
                <i class="fas fa-users"></i>
                <span>${challenge.participants ? challenge.participants.length : 0} Participants</span>
            </div>
            <button class="secondary-btn">
                <i class="fas fa-cog"></i>
                Manage
            </button>
        </div>
    `;
    
    return card;
}

// Modal functionality
addChallengeBtn.addEventListener('click', () => {
    addChallengeModal.classList.add('active');
});

closeModalBtn.addEventListener('click', () => {
    addChallengeModal.classList.remove('active');
});

addChallengeModal.addEventListener('click', (e) => {
    if (e.target === addChallengeModal) {
        addChallengeModal.classList.remove('active');
    }
});

// Add new challenge
addChallengeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(addChallengeForm);
    const challengeData = {
        title: formData.get('title'),
        subject: formData.get('subject'),
        entryFee: Number(formData.get('entryFee')),
        prize: Number(formData.get('prize')),
        startTime: new Date(formData.get('startTime')).toISOString(),
        endTime: new Date(formData.get('endTime')).toISOString(),
        bannerUrl: formData.get('bannerUrl') || null,
        participants: [],
        createdAt: serverTimestamp()
    };
    
    try {
        await addDoc(collection(db, 'contests'), challengeData);
        showToast('Challenge created successfully!');
        addChallengeForm.reset();
        addChallengeModal.classList.remove('active');
    } catch (error) {
        console.error('Error creating challenge:', error);
        showToast('Error creating challenge. Please try again.', 'error');
    }
});

// Fetch and display challenges
function fetchChallenges() {
    const challengesQuery = query(collection(db, 'contests'), orderBy('createdAt', 'desc'));
    
    onSnapshot(challengesQuery, (snapshot) => {
        challengesGrid.innerHTML = '';
        
        snapshot.forEach((doc) => {
            const challenge = { id: doc.id, ...doc.data() };
            const card = createChallengeCard(challenge);
            challengesGrid.appendChild(card);
        });
    }, (error) => {
        console.error('Error fetching challenges:', error);
        showToast('Error loading challenges. Please refresh the page.', 'error');
    });
}

// Logout functionality
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = '../login.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

// Initial fetch
fetchChallenges(); 