import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, Timestamp, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
    const loadingSpinner = document.getElementById('loading-spinner');
    const quizContent = document.querySelector('.quiz-content');
    
    if (loadingSpinner) {
        loadingSpinner.classList.remove('hidden');
    }
    
    if (quizContent) {
        quizContent.classList.add('hidden');
    }
}

function hideLoading() {
    const loadingSpinner = document.getElementById('loading-spinner');
    const quizContent = document.querySelector('.quiz-content');
    
    if (loadingSpinner) {
        loadingSpinner.classList.add('hidden');
    }
    
    if (quizContent) {
        quizContent.classList.remove('hidden');
    }
}

function showError(message) {
    const feedbackMessage = document.getElementById('feedback-message');
    if (feedbackMessage) {
        feedbackMessage.textContent = message;
        feedbackMessage.classList.add('wrong');
        feedbackMessage.style.display = 'block';
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0 mins 0 sec';
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
    
    // Save results to Firebase
    if (currentUser) {
        const contestId = getContestIdFromUrl();
        if (contestId) {
            await saveResults(currentUser.uid, contestId, results);
            // Remove quiz container and show results
            removeQuizContainer();
            showResults(results);
        } else {
            console.error('Contest ID not found in URL.');
            showError('Could not save results: Contest ID missing.');
        }
    } else {
        console.warn('User not logged in. Results not saved.');
    }
}

function removeQuizContainer() {
    // Remove the entire quiz container
    const quizContainer = document.querySelector('.quiz-container');
    if (quizContainer) {
        quizContainer.remove();
    }
    
    // Also remove any remaining quiz-related elements
    const quizContent = document.querySelector('.quiz-content');
    if (quizContent) {
        quizContent.remove();
    }
    
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner) {
        loadingSpinner.remove();
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
    // Create new results container
    const mainContent = document.querySelector('.main-content');
    
    // Clear any existing results container
    const existingResults = document.getElementById('results-container');
    if (existingResults) {
        existingResults.remove();
    }
    
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'results-container';
    resultsContainer.className = 'results-container';
    
    // Add winner status section first
    const winnerSection = document.createElement('div');
    winnerSection.id = 'winner-announcement';
    winnerSection.className = 'winner-announcement';
    resultsContainer.appendChild(winnerSection);
    
    // Add results stats
    const statsSection = document.createElement('div');
    statsSection.className = 'results-stats';
    statsSection.innerHTML = `
        <div class="stat-card">
            <h3>Total Score</h3>
            <p id="total-score">${results.score}</p>
        </div>
        <div class="stat-card">
            <h3>Correct Answers</h3>
            <p id="correct-answers">${results.correct}</p>
        </div>
        <div class="stat-card">
            <h3>Wrong Answers</h3>
            <p id="wrong-answers">${results.wrong}</p>
        </div>
        <div class="stat-card">
            <h3>Time Taken</h3>
            <p id="time-taken">${formatTime(results.timeTaken)}</p>
        </div>
    `;
    resultsContainer.appendChild(statsSection);
    
    // Add back button
    const backButton = document.createElement('button');
    backButton.id = 'back-to-contests';
    backButton.className = 'nav-btn';
    backButton.innerHTML = `
        <i class="fas fa-arrow-left"></i>
        Back to Contests
    `;
    backButton.addEventListener('click', () => {
        window.location.href = '../my-challenges.html';
    });
    resultsContainer.appendChild(backButton);
    
    // Add results container to main content
    mainContent.appendChild(resultsContainer);
    
    // Check winner status
    checkWinnerStatus();
}

async function checkWinnerStatus() {
    const contestId = getContestIdFromUrl();
    if (!contestId) return;

    try {
        const contestRef = doc(db, 'contests', contestId);
        const contestDoc = await getDoc(contestRef);

        if (contestDoc.exists()) {
            const contestData = contestDoc.data();
            const winnerSection = document.getElementById('winner-announcement');
            
            if (contestData.winner) {
                // Winner has been announced
                const isWinner = contestData.winner === currentUser.uid;
                winnerSection.innerHTML = `
                    <h3 class="text-3xl font-bold mb-4">${isWinner ? '🎉 Congratulations! 🎉' : 'Winner Announcement'}</h3>
                    <div class="bg-green-100">
                        <p>
                            ${isWinner ? 
                                '<i class="fas fa-trophy"></i> You are the winner of this contest!' : 
                                '<i class="fas fa-trophy"></i> The winner has been announced'}
                        </p>
                        ${!isWinner ? `
                            <p class="mt-4 text-lg">
                                Better luck next time! Keep participating to win more contests.
                            </p>
                        ` : ''}
                    </div>
                `;
            } else {
                // Winner pending
                const completionTime = new Date(contestData.completionTime?.toDate() || Date.now());
                const announcementTime = new Date(completionTime.getTime() + 24 * 60 * 60 * 1000);
                const timeUntilAnnouncement = announcementTime - Date.now();

                if (timeUntilAnnouncement > 0) {
                    // Still waiting for announcement
                    const hours = Math.floor(timeUntilAnnouncement / (60 * 60 * 1000));
                    const minutes = Math.floor((timeUntilAnnouncement % (60 * 60 * 1000)) / (60 * 1000));
                    
                    winnerSection.innerHTML = `
                        <h3 class="text-3xl font-bold mb-4">Winner Status</h3>
                        <div class="bg-yellow-100">
                            <p>
                                <i class="fas fa-clock"></i>
                                Winner will be announced in ${hours}h ${minutes}m
                            </p>
                            <p class="mt-4 text-lg">
                                Stay tuned! The winner will be announced soon.
                            </p>
                        </div>
                    `;
                } else {
                    // Announcement time has passed but no winner yet
                    winnerSection.innerHTML = `
                        <h3 class="text-3xl font-bold mb-4">Winner Status</h3>
                        <div class="bg-yellow-100">
                            <p>
                                <i class="fas fa-clock"></i>
                                Winner announcement is pending
                            </p>
                            <p class="mt-4 text-lg">
                                The winner will be announced shortly. Please check back later.
                            </p>
                        </div>
                    `;
                }
            }
        }
    } catch (error) {
        console.error('Error checking winner status:', error);
    }
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
            // Ensure challengeHistory is an array, default to empty array if null/undefined
            let challengeHistory = Array.isArray(userData.challengeHistory) ? userData.challengeHistory : [];

            // Find existing entry for this contest
            const existingEntryIndex = challengeHistory.findIndex(entry => entry.contestId === contestId);
            
            // Create the history entry with results
            const historyEntryWithResults = {
                contestId: contestId,
                joinedAt: existingEntryIndex !== -1 ? challengeHistory[existingEntryIndex].joinedAt : Timestamp.now(),
                status: 'completed', // Set status to completed
                score: results.score || 0,
                correct: results.correct || 0,
                wrong: results.wrong || 0,
                timeTaken: results.timeTaken || 0,
                completedAt: Timestamp.now(),
                winnerStatus: 'pending' // Default winner status
            };

            // Update or add the entry
            if (existingEntryIndex !== -1) {
                challengeHistory[existingEntryIndex] = historyEntryWithResults;
            } else {
                challengeHistory.push(historyEntryWithResults);
            }

            // Update the user document
            await updateDoc(userRef, {
                challengeHistory: challengeHistory,
                lastUpdated: serverTimestamp()
            });

            console.log(`Saved quiz results for contest ${contestId} for user ${userId}`);

            // Update contest document to add user to participants if not already there
            const contestRef = doc(db, 'contests', contestId);
            const contestDocSnap = await getDoc(contestRef);
            
            if (contestDocSnap.exists()) {
                const contestData = contestDocSnap.data();
                if (!contestData.participants?.includes(userId)) {
                    await updateDoc(contestRef, {
                        participants: arrayUnion(userId),
                        lastUpdated: serverTimestamp()
                    });
                }
            }

            // Set quiz as completed
            quizCompleted = true;

            // Show results
            removeQuizContainer();
            showResults(results);

        } else {
            console.error('User document not found for saving results.');
            showError('Failed to save quiz results: User document missing.');
        }
    } catch (error) {
        console.error('Error saving quiz results:', error);
        showError('Failed to save quiz results. Please try again.');
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

                // Check if we're viewing results from my-challenges page
                const isViewingResults = window.location.pathname.includes('results.html');
                
                if (isViewingResults) {
                    if (existingEntry && existingEntry.status === 'completed') {
                        // Convert timeTaken string back to seconds if it's stored as a string
                        let timeTaken = existingEntry.timeTaken;
                        if (typeof timeTaken === 'string') {
                            const timeParts = timeTaken.match(/(\d+)\s*mins\s*(\d+)\s*sec/);
                            if (timeParts) {
                                timeTaken = (parseInt(timeParts[1]) * 60) + parseInt(timeParts[2]);
                            }
                        }
                        const results = {
                            score: existingEntry.score,
                            correct: existingEntry.correct,
                            wrong: existingEntry.wrong,
                            timeTaken: timeTaken
                        };
                        removeQuizContainer();
                        showResults(results);
                        quizCompleted = true;
                        return;
                    } else {
                        showError('Quiz not completed yet. Please complete the quiz first.');
                        return;
                    }
                }

                // If we're taking the quiz and it's already completed
                if (existingEntry && existingEntry.status === 'completed') {
                    console.log('User has already completed this quiz.');
                    let timeTaken = existingEntry.timeTaken;
                    if (typeof timeTaken === 'string') {
                        const timeParts = timeTaken.match(/(\d+)\s*mins\s*(\d+)\s*sec/);
                        if (timeParts) {
                            timeTaken = (parseInt(timeParts[1]) * 60) + parseInt(timeParts[2]);
                        }
                    }
                    const results = {
                        score: existingEntry.score,
                        correct: existingEntry.correct,
                        wrong: existingEntry.wrong,
                        timeTaken: timeTaken
                    };
                    removeQuizContainer();
                    showResults(results);
                    quizCompleted = true;
                    return;
                }
            }

            // If quiz data exists and it's not completed, proceed to load questions
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