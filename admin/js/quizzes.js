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
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    serverTimestamp,
    setDoc
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
const addQuizBtn = document.getElementById('add-quiz-btn');
const addQuizModal = document.getElementById('add-quiz-modal');
const addQuizForm = document.getElementById('add-quiz-form');
const closeModalBtn = document.getElementById('close-modal');
const quizzesGrid = document.getElementById('quizzes-grid');
const logoutBtn = document.getElementById('logout-btn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const contestSelect = document.getElementById('contest');

// Show toast notification
function showToast(message, type = 'success') {
    toast.className = `toast ${type}`;
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Fetch contests for dropdown
async function fetchContests() {
    try {
        const contestsQuery = query(collection(db, 'contests'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(contestsQuery);
        
        contestSelect.innerHTML = '<option value="">Select a contest...</option>';
        
        snapshot.forEach((doc) => {
            const contest = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = contest.title;
            contestSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching contests:', error);
        showToast('Error loading contests. Please refresh the page.', 'error');
    }
}

// Create quiz card
function createQuizCard(contestId, contest, questions) {
    const card = document.createElement('div');
    card.className = 'quiz-card';
    
    card.innerHTML = `
        <div class="quiz-header">
            <div>
                <h3 class="quiz-title">${contest.title}</h3>
                <span class="quiz-subject">${contest.subject}</span>
            </div>
        </div>
        <div class="questions-list">
            ${questions.map((q, index) => `
                <div class="question-item">
                    <div class="question-text">${index + 1}. ${q.question}</div>
                    <div class="options-list">
                        <div class="option ${q.correctOption === 'A' ? 'correct' : ''}">
                            <span>A.</span> ${q.options[0]}
                        </div>
                        <div class="option ${q.correctOption === 'B' ? 'correct' : ''}">
                            <span>B.</span> ${q.options[1]}
                        </div>
                        <div class="option ${q.correctOption === 'C' ? 'correct' : ''}">
                            <span>C.</span> ${q.options[2]}
                        </div>
                        <div class="option ${q.correctOption === 'D' ? 'correct' : ''}">
                            <span>D.</span> ${q.options[3]}
                        </div>
                    </div>
                    <div class="question-footer">
                        <span>Points: ${q.points}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    return card;
}

// Modal functionality
addQuizBtn.addEventListener('click', () => {
    addQuizModal.classList.add('active');
});

closeModalBtn.addEventListener('click', () => {
    addQuizModal.classList.remove('active');
});

addQuizModal.addEventListener('click', (e) => {
    if (e.target === addQuizModal) {
        addQuizModal.classList.remove('active');
    }
});

// Add new quiz question
addQuizForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(addQuizForm);
    const contestId = formData.get('contest');
    
    const questionData = {
        question: formData.get('question'),
        options: [
            formData.get('optionA'),
            formData.get('optionB'),
            formData.get('optionC'),
            formData.get('optionD')
        ],
        correctOption: formData.get('correctOption'),
        points: Number(formData.get('points')),
        createdAt: new Date().toISOString()
    };
    
    try {
        const quizRef = doc(db, 'quiz', contestId);
        const quizDoc = await getDoc(quizRef);
        
        if (quizDoc.exists()) {
            // Update existing quiz document
            const currentQuestions = quizDoc.data().questions || [];
            await updateDoc(quizRef, {
                questions: [...currentQuestions, questionData]
            });
        } else {
            // Create new quiz document
            await setDoc(quizRef, {
                contestId,
                questions: [questionData],
                createdAt: new Date().toISOString()
            });
        }
        
        showToast('Question added successfully!');
        addQuizForm.reset();
        addQuizModal.classList.remove('active');
        fetchQuizzes(); // Refresh the display
    } catch (error) {
        console.error('Error adding question:', error);
        showToast('Error adding question. Please try again.', 'error');
    }
});

// Fetch and display quizzes
async function fetchQuizzes() {
    try {
        const contestsQuery = query(collection(db, 'contests'), orderBy('createdAt', 'desc'));
        const contestsSnapshot = await getDocs(contestsQuery);
        
        quizzesGrid.innerHTML = '';
        
        for (const contestDoc of contestsSnapshot.docs) {
            const contest = contestDoc.data();
            const quizDoc = await getDoc(doc(db, 'quiz', contestDoc.id));
            
            if (quizDoc.exists()) {
                const quizData = quizDoc.data();
                const card = createQuizCard(contestDoc.id, contest, quizData.questions);
                quizzesGrid.appendChild(card);
            }
        }
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        showToast('Error loading quizzes. Please refresh the page.', 'error');
    }
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
fetchContests();
fetchQuizzes(); 