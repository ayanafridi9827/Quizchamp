import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const quizTitleElement = document.querySelector('.quiz-title');
const timeRemainingElement = document.getElementById('time-remaining');
const currentQuestionElement = document.getElementById('current-question');
const totalQuestionsElement = document.getElementById('total-questions');
const questionTextElement = document.querySelector('.question-text');
const optionsContainer = document.querySelector('.options-container');
const feedbackMessage = document.getElementById('feedback-message');
const prevButton = document.getElementById('prev-btn');
const nextButton = document.getElementById('next-btn');
const submitQuizButton = document.getElementById('submit-quiz');
const loadingSpinner = document.getElementById('loading-spinner');
const quizContent = document.querySelector('.quiz-content');
const resultsContainer = document.getElementById('results-container');
const totalScoreElement = document.getElementById('total-score');
const correctAnswersElement = document.getElementById('correct-answers');
const wrongAnswersElement = document.getElementById('wrong-answers');
const timeTakenElement = document.getElementById('time-taken');
const backToContestsButton = document.getElementById('back-to-contests');

// Quiz State
let quizData = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let timerInterval = null;
let timeElapsed = 0;
let startTime = null;
let isAnswerSubmitted = false;
let currentUser = null;
let quizCompleted = false;

// Sound Effects
const correctSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3');
const wrongSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3');

// Utility Functions
function showLoading() {
    loadingSpinner.classList.remove('hidden');
    quizContent.classList.add('hidden');
    resultsContainer.style.display = 'none';
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
    quizContent.classList.remove('hidden');
}

function showError(message) {
    feedbackMessage.textContent = message;
    feedbackMessage.classList.add('wrong');
    feedbackMessage.style.display = 'block';
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} mins ${remainingSeconds} sec`;
}

// Timer Functions
function startTimer() {
    startTime = Date.now();
    timeElapsed = 0;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeElapsed = Math.floor((Date.now() - startTime) / 1000);
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeElapsed / 60);
    const seconds = timeElapsed % 60;
    const milliseconds = Math.floor(((Date.now() - startTime) % 1000) / 100);
    timeRemainingElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds}`;

    const timerElement = timeRemainingElement.parentElement;
    timerElement.classList.remove('warning', 'danger');
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// Question Rendering
function renderQuestion() {
    const question = quizData.questions[currentQuestionIndex];
    isAnswerSubmitted = false;
    
    // Update progress
    currentQuestionElement.textContent = currentQuestionIndex + 1;
    totalQuestionsElement.textContent = quizData.questions.length;
    
    // Update question text
    questionTextElement.textContent = question.question;
    
    // Clear previous options and feedback
    optionsContainer.innerHTML = '';
    feedbackMessage.style.display = 'none';
    feedbackMessage.className = 'feedback-message';
    
    // Add new options with A, B, C, D labels
    const optionLabels = ['A', 'B', 'C', 'D'];
    question.options.forEach((option, index) => {
        const optionButton = document.createElement('button');
        optionButton.className = 'option-button';
        optionButton.textContent = `${optionLabels[index]}. ${option}`;
        optionButton.dataset.optionIndex = index;
        
        optionButton.addEventListener('click', () => selectOption(optionButton, index));
        optionsContainer.appendChild(optionButton);
    });
    
    // Update navigation buttons
    prevButton.style.display = 'none';
    nextButton.disabled = true;
    nextButton.textContent = 'Next Question';
    submitQuizButton.style.display = 'none';
    submitQuizButton.disabled = true;
}

function selectOption(optionButton, optionIndex) {
    if (isAnswerSubmitted) return;
    
    // Remove selected class from all options
    document.querySelectorAll('.option-button').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Add selected class to clicked option
    optionButton.classList.add('selected');
    
    // Show submit button
    submitQuizButton.style.display = 'block';
    submitQuizButton.disabled = false;
}

function submitAnswer() {
    if (isAnswerSubmitted) return;
    
    const selectedOption = document.querySelector('.option-button.selected');
    if (!selectedOption) {
        showError('Please select an answer');
        return;
    }
    
    const optionIndex = parseInt(selectedOption.dataset.optionIndex);
    const currentQuestion = quizData.questions[currentQuestionIndex];

    // Map the selected option index to its corresponding letter (A, B, C, D)
    const indexToLetter = ['A', 'B', 'C', 'D'];
    const selectedOptionLetter = indexToLetter[optionIndex];

    // Compare the selected option letter with the correctOption letter from Firebase
    const isCorrect = selectedOptionLetter === currentQuestion.correctOption;
    
    // Store the answer
    userAnswers[currentQuestionIndex] = {
        questionIndex: currentQuestionIndex,
        selectedOption: optionIndex,
        isCorrect: isCorrect
    };
    
    // Show feedback
    showFeedback(isCorrect);
    
    // Disable all options
    document.querySelectorAll('.option-button').forEach(btn => {
        btn.disabled = true;
    });
    
    // Enable next button
    enableNextButton();
    
    // Hide submit button
    submitQuizButton.style.display = 'none';
    
    isAnswerSubmitted = true;
}

function showFeedback(isCorrect) {
    feedbackMessage.textContent = isCorrect ? 'Correct! ✅' : 'Wrong! ❌';
    feedbackMessage.className = 'feedback-message ' + (isCorrect ? 'correct' : 'wrong');
    feedbackMessage.style.display = 'block';
    
    // Highlight selected option (and correct option if wrong)
    document.querySelectorAll('.option-button').forEach(btn => {
        const optionIndex = parseInt(btn.dataset.optionIndex);
        const currentQuestion = quizData.questions[currentQuestionIndex];

        if (isCorrect && btn.classList.contains('selected')) {
            btn.classList.add('correct');
        } else if (!isCorrect && btn.classList.contains('selected')) {
            btn.classList.add('wrong');
        }

        // Always show the correct answer
        if (optionIndex === currentQuestion.correctOption) {
             btn.classList.add('correct');
        }
    });

    // Play sound effect
    if (isCorrect) {
        correctSound.play();
    } else {
        wrongSound.play();
    }
}

function enableNextButton() {
    nextButton.disabled = false;
    if (currentQuestionIndex === quizData.questions.length - 1) {
        nextButton.textContent = 'Finish Quiz';
    } else {
        nextButton.textContent = 'Next Question';
    }
}

// Quiz Navigation
function goToNextQuestion() {
    if (currentQuestionIndex < quizData.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        finishQuiz();
    }
}

// Quiz Completion
async function finishQuiz() {
    stopTimer();
    
    // Calculate results
    const results = calculateResults();
    
    // Show results
    showResults(results);
    
    // Save results to Firebase
    if (currentUser) {
        const contestId = getContestIdFromUrl();
        if (contestId) {
            await saveResults(currentUser.uid, contestId, results);
        } else {
            console.error('Contest ID not found in URL.');
            showError('Could not save results: Contest ID missing.');
        }
    } else {
        console.warn('User not logged in. Results not saved.');
    }
}

function calculateResults() {
    let score = 0;
    let correct = 0;
    let wrong = 0;

    userAnswers.forEach(answer => {
        if (answer && answer.hasOwnProperty('isCorrect')) {
             if (answer.isCorrect) {
                correct++;
                score += 10;
            } else {
                wrong++;
                score -= 10;
            }
        }
    });

    const timeTaken = timeElapsed;

    return {
        score,
        correct,
        wrong,
        timeTaken
    };
}

function showResults(results) {
    hideLoading();
    
    // Populate results container
    totalScoreElement.textContent = results.score;
    correctAnswersElement.textContent = results.correct;
    wrongAnswersElement.textContent = results.wrong;
    timeTakenElement.textContent = formatTime(results.timeTaken);

    quizContent.style.display = 'none';
    resultsContainer.style.display = 'block';

    backToContestsButton.addEventListener('click', () => {
        window.location.href = '../my-challenges.html';
    });
}

async function saveResults(userId, contestId, results) {
    if (quizCompleted) {
        console.log('Quiz already completed and results saved.');
        return;
    }

    const userRef = doc(db, 'users', userId);

    try {
        const userDocSnap = await getDoc(userRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const challengeHistory = Array.isArray(userData.challengeHistory) ? userData.challengeHistory : [];

            const existingEntryIndex = challengeHistory.findIndex(entry => entry.contestId === contestId);

            if (existingEntryIndex === -1) {
                const newHistoryEntry = {
                    contestId: contestId,
                    score: results.score,
                    correct: results.correct,
                    wrong: results.wrong,
                    timeTaken: formatTime(results.timeTaken),
                    completedAt: Timestamp.now()
                };

                await updateDoc(userRef, {
                    challengeHistory: arrayUnion(newHistoryEntry)
                });
                console.log('Quiz results saved successfully!');
                quizCompleted = true;
            } else {
                console.log('Quiz results for this contest already saved.');
                quizCompleted = true;
            }

            const contestRef = doc(db, 'contests', contestId);
            const contestDocSnap = await getDoc(contestRef);

            if (contestDocSnap.exists()) {
                const contestData = contestDocSnap.data();
                const participants = Array.isArray(contestData.participants) ? contestData.participants : [];

                if (!participants.includes(userId)) {
                    await updateDoc(contestRef, {
                        participants: arrayUnion(userId)
                    });
                    console.log('User added to contest participants.');
                }
            } else {
                console.warn('Contest document not found for ID:', contestId, '. Could not update participants.');
            }

        } else {
            console.error('User document not found.');
            showError('Failed to save quiz results: User document missing.');
        }
    } catch (error) {
        console.error('Error saving quiz results:', error);
        showError('Failed to save quiz results.');
    }
}

// URL Parameter Functions
function getContestIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('contestId');
}

// Event Listeners
nextButton.addEventListener('click', goToNextQuestion);
submitQuizButton.addEventListener('click', submitAnswer);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const contestId = getContestIdFromUrl();
        if (contestId) {
            fetchQuizData(contestId);
        } else {
            showError('Contest ID not specified in the URL.');
            console.error('Contest ID is missing from the URL.');
        }
    } else {
        console.log('No user logged in. Redirecting to login.');
        window.location.href = '../auth/login.html';
    }
});

async function fetchQuizData(contestId) {
    showLoading();
    try {
        const quizDocRef = doc(db, 'quiz', contestId);
        const quizDocSnap = await getDoc(quizDocRef);

        if (quizDocSnap.exists()) {
            quizData = quizDocSnap.data();

            const userRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                const challengeHistory = Array.isArray(userData.challengeHistory) ? userData.challengeHistory : [];
                const existingEntry = challengeHistory.find(entry => entry.contestId === contestId);

                if (existingEntry) {
                    console.log('User has already completed this quiz.');
                    showResults(existingEntry);
                    quizCompleted = true;
                    stopTimer();
                    return;
                }
            }

            if (quizData.questions && quizData.questions.length > 0) {
                startTimer();
                renderQuestion();
                hideLoading();
                if (quizData.title && quizTitleElement) {
                    quizTitleElement.textContent = quizData.title;
                } else if (quizTitleElement) {
                    quizTitleElement.textContent = 'Quiz';
                }
            } else {
                showError('No questions found for this contest.');
                console.error('No questions found for contest ID:', contestId);
            }
        } else {
            showError('Quiz data not found for this contest.');
            console.error('No quiz data found for contest ID:', contestId);
        }
    } catch (error) {
        console.error('Error fetching quiz data or checking history:', error);
        showError('Failed to load quiz data.');
    }
} 