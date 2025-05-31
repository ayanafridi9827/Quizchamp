import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    // Your Firebase config here
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const quizContainer = document.querySelector('.quiz-container');
const accessDenied = document.querySelector('.access-denied');
const quizTitle = document.querySelector('.quiz-title');
const timeRemaining = document.getElementById('time-remaining');
const currentQuestion = document.getElementById('current-question');
const totalQuestions = document.getElementById('total-questions');
const questionText = document.querySelector('.question-text');
const optionsContainer = document.querySelector('.options-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const submitBtn = document.getElementById('submit-quiz');

// Quiz State
let quizData = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let timer = null;
let timeLeft = 0;

// Get challenge ID from URL
const urlParams = new URLSearchParams(window.location.search);
const challengeId = urlParams.get('id');

if (!challengeId) {
    showAccessDenied('Invalid quiz access. Please select a challenge first.');
}

// Check if user has joined the challenge
async function checkChallengeAccess() {
    const user = auth.currentUser;
    if (!user) {
        showAccessDenied('Please sign in to access the quiz.');
        return false;
    }

    try {
        const userChallengesRef = collection(db, 'userChallenges');
        const q = query(userChallengesRef, 
            where('userId', '==', user.uid),
            where('challengeId', '==', challengeId)
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            showAccessDenied('Please join the challenge first to attempt the quiz.');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking challenge access:', error);
        showAccessDenied('Error checking challenge access. Please try again.');
        return false;
    }
}

// Fetch quiz data
async function fetchQuizData() {
    try {
        const quizRef = doc(db, 'quizzes', challengeId);
        const quizDoc = await getDoc(quizRef);
        
        if (!quizDoc.exists()) {
            showAccessDenied('Quiz not found for this challenge.');
            return;
        }

        quizData = quizDoc.data();
        initializeQuiz();
    } catch (error) {
        console.error('Error fetching quiz data:', error);
        showAccessDenied('Error loading quiz. Please try again.');
    }
}

// Initialize quiz
function initializeQuiz() {
    quizTitle.textContent = quizData.title;
    totalQuestions.textContent = quizData.questions.length;
    timeLeft = quizData.timeLimit * 60; // Convert minutes to seconds
    userAnswers = new Array(quizData.questions.length).fill(null);
    
    startTimer();
    displayQuestion();
    updateNavigationButtons();
}

// Display current question
function displayQuestion() {
    const question = quizData.questions[currentQuestionIndex];
    questionText.textContent = question.text;
    currentQuestion.textContent = currentQuestionIndex + 1;
    
    optionsContainer.innerHTML = '';
    question.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        if (userAnswers[currentQuestionIndex] === index) {
            optionElement.classList.add('selected');
        }
        optionElement.textContent = option;
        optionElement.addEventListener('click', () => selectOption(index));
        optionsContainer.appendChild(optionElement);
    });
}

// Select option
function selectOption(optionIndex) {
    userAnswers[currentQuestionIndex] = optionIndex;
    displayQuestion(); // Refresh to show selection
    updateNavigationButtons();
}

// Update navigation buttons
function updateNavigationButtons() {
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.disabled = currentQuestionIndex === quizData.questions.length - 1;
    submitBtn.disabled = userAnswers.includes(null);
}

// Start timer
function startTimer() {
    updateTimerDisplay();
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            submitQuiz();
        }
    }, 1000);
}

// Update timer display
function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeRemaining.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Submit quiz
async function submitQuiz() {
    clearInterval(timer);
    
    // Calculate score
    let score = 0;
    quizData.questions.forEach((question, index) => {
        if (userAnswers[index] === question.correctAnswer) {
            score++;
        }
    });

    // Update user's score in the challenge
    try {
        const user = auth.currentUser;
        const userChallengesRef = collection(db, 'userChallenges');
        const q = query(userChallengesRef, 
            where('userId', '==', user.uid),
            where('challengeId', '==', challengeId)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userChallengeDoc = querySnapshot.docs[0];
            await userChallengeDoc.ref.update({
                score: score,
                maxScore: quizData.questions.length,
                completedAt: new Date()
            });
        }

        // Redirect to results page
        window.location.href = `../my-challenges.html?completed=${challengeId}`;
    } catch (error) {
        console.error('Error submitting quiz:', error);
        showAccessDenied('Error submitting quiz. Please try again.');
    }
}

// Show access denied message
function showAccessDenied(message) {
    quizContainer.classList.add('hidden');
    accessDenied.classList.remove('hidden');
    accessDenied.querySelector('p').textContent = message;
}

// Event Listeners
prevBtn.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
        updateNavigationButtons();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentQuestionIndex < quizData.questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
        updateNavigationButtons();
    }
});

submitBtn.addEventListener('click', submitQuiz);

// Initialize
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const hasAccess = await checkChallengeAccess();
        if (hasAccess) {
            await fetchQuizData();
        }
    } else {
        showAccessDenied('Please sign in to access the quiz.');
    }
}); 