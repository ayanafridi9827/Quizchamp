// Import Firebase services from centralized config
import { auth, db } from './firebase-config.js';

// Import other Firebase functions
import { 
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    where,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
let contestList;
let selectedContestTitle;
let selectedContestDates;
let questionsList;
let loadingSpinner;
let toast;
let toastMessage;
let saveQuizBtn;
let addQuestionBtn;
let logoutBtn;

// State management
let currentContestId = null;
let currentQuiz = null;
let allContests = [];
let allQuizzes = [];

// Initialize DOM elements
function initializeElements() {
    contestList = document.getElementById('contest-list');
    selectedContestTitle = document.getElementById('selected-contest-title');
    selectedContestDates = document.getElementById('selected-contest-dates');
    questionsList = document.getElementById('questions-list');
    loadingSpinner = document.getElementById('loading-spinner');
    toast = document.getElementById('toast');
    toastMessage = document.getElementById('toast-message');
    saveQuizBtn = document.getElementById('save-quiz-btn');
    addQuestionBtn = document.getElementById('add-question-btn');
    logoutBtn = document.getElementById('logout-btn');

    if (!contestList || !selectedContestTitle || !selectedContestDates || !questionsList || 
        !loadingSpinner || !toast || !toastMessage || !saveQuizBtn || !addQuestionBtn || !logoutBtn) {
        console.error('Required DOM elements not found');
        return false;
    }
    return true;
}

// Initialize event listeners
function initializeEventListeners() {
    // Save quiz button
    saveQuizBtn.addEventListener('click', saveQuestions);

    // Add question button
    addQuestionBtn.addEventListener('click', addNewQuestion);

    // Logout button
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = '../login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            showToast('Error signing out. Please try again.', 'error');
        }
    });
}

// Initialize application
async function initializeApp() {
    try {
        // Initialize DOM elements
        const elementsInitialized = initializeElements();
        if (!elementsInitialized) {
            throw new Error('Failed to initialize DOM elements');
        }

        // Initialize event listeners
        initializeEventListeners();

        // Check authentication state
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log('User authenticated:', user.email);
                fetchContests();
            } else {
                console.log('No user authenticated');
                window.location.href = '../login.html';
            }
        });
    } catch (error) {
        console.error('Error initializing application:', error);
        showToast('Error initializing application. Please refresh the page.', 'error');
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    if (!toast || !toastMessage) {
        console.error('Toast elements not found');
        return;
    }
    toast.className = `toast ${type}`;
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Show loading spinner
function showLoading() {
    loadingSpinner.classList.add('active');
    contestList.style.display = 'none';
}

// Hide loading spinner
function hideLoading() {
    loadingSpinner.classList.remove('active');
    contestList.style.display = 'grid';
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Fetch contests and populate list
async function fetchContests() {
    try {
        showLoading();
        console.log('Fetching contests...');
        
        const contestsQuery = query(
            collection(db, 'contests'),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(contestsQuery);
        console.log('Contests fetched:', snapshot.size);
        
        // Clear existing content
        contestList.innerHTML = '';
        
        if (snapshot.empty) {
            console.log('No contests found');
            contestList.innerHTML = `
                <div class="no-contests">
                    <i class="fas fa-trophy"></i>
                    <p>No contests found</p>
                    <small>Create a contest to add quiz questions</small>
                </div>
            `;
            return;
        }
        
        // Add each contest to the list
        snapshot.forEach((doc) => {
            const contest = { id: doc.id, ...doc.data() };
            console.log('Adding contest:', contest);
            
            const contestElement = document.createElement('div');
            contestElement.className = 'contest-item';
            contestElement.dataset.contestId = contest.id;
            
            // Format dates
            const startDate = contest.startDate ? new Date(contest.startDate.toDate()).toLocaleDateString() : 'Not set';
            const endDate = contest.endDate ? new Date(contest.endDate.toDate()).toLocaleDateString() : 'Not set';
            
            // Set contest status
            let status = 'draft';
            const now = new Date();
            if (contest.startDate && contest.endDate) {
                if (now < contest.startDate.toDate()) {
                    status = 'upcoming';
                } else if (now > contest.endDate.toDate()) {
                    status = 'ended';
                } else {
                    status = 'active';
                }
            }
            
            contestElement.innerHTML = `
                <div class="contest-item-title">${contest.title || 'Untitled Contest'}</div>
                <div class="contest-item-dates">
                    ${startDate} - ${endDate}
                </div>
                <div class="contest-item-status ${status}">
                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
            `;
            
            // Add click event
            contestElement.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.contest-item').forEach(item => {
                    item.classList.remove('active');
                });
                contestElement.classList.add('active');
                
                // Update selected contest info
                selectedContestTitle.textContent = contest.title || 'Untitled Contest';
                selectedContestDates.textContent = `${startDate} - ${endDate}`;
                
                // Set current contest and fetch its quiz
                currentContestId = contest.id;
                fetchQuizForContest(contest.id);
            });
            
            contestList.appendChild(contestElement);
        });

    } catch (error) {
        console.error('Error fetching contests:', error);
        showToast('Error loading contests. Please refresh the page.', 'error');
        contestList.innerHTML = `
            <div class="no-contests">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading contests</p>
                <small>Please try refreshing the page</small>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// Fetch quiz for selected contest
async function fetchQuizForContest(contestId) {
    try {
        showLoading();
        console.log('Fetching quiz for contest:', contestId);
        
        const quizQuery = query(
            collection(db, 'quiz'),
            where('contestId', '==', contestId)
        );
        
        const querySnapshot = await getDocs(quizQuery);
        console.log('Quiz query result:', querySnapshot.size, 'documents');
        
        if (!querySnapshot.empty) {
            const quizDoc = querySnapshot.docs[0];
            currentQuiz = { id: quizDoc.id, ...quizDoc.data() };
            console.log('Quiz loaded:', currentQuiz);
            displayQuestions(currentQuiz.questions);
        } else {
            console.log('No quiz found for contest');
            currentQuiz = null;
            displayQuestions([]);
        }
    } catch (error) {
        console.error('Error fetching quiz:', error);
        showToast('Error loading quiz. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Display questions in the list
function displayQuestions(questions) {
    questionsList.innerHTML = '';
    
    if (!questions || questions.length === 0) {
        questionsList.innerHTML = `
            <div class="no-questions">
                <i class="fas fa-question-circle"></i>
                <p>No questions yet</p>
                <small>Click "Add New Question" to create your first question</small>
            </div>
        `;
        return;
    }
    
    questions.forEach((question, index) => {
        const questionElement = createQuestionElement(question, index);
        questionsList.appendChild(questionElement);
    });
}

// Create question element
function createQuestionElement(question, index) {
    const div = document.createElement('div');
    div.className = 'question-card';
    div.dataset.index = index;
    
    div.innerHTML = `
        <div class="question-header">
            <div class="question-number">Question ${index + 1}</div>
            <div class="question-actions">
                <button class="action-btn edit" onclick="editQuestion(${index})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete" onclick="deleteQuestion(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="question-content">
            <div class="form-group">
                <label>Question Text</label>
                <textarea class="form-control question-text" rows="2">${question.question}</textarea>
            </div>
            <div class="options-grid">
                ${question.options.map((option, optIndex) => `
                    <div class="form-group">
                        <label>Option ${String.fromCharCode(65 + optIndex)}</label>
                        <input type="text" class="form-control option-input" value="${option}">
                    </div>
                `).join('')}
            </div>
            <div class="form-group">
                <label>Correct Option</label>
                <select class="form-control correct-option">
                    ${question.options.map((_, optIndex) => `
                        <option value="${String.fromCharCode(65 + optIndex)}" 
                                ${question.correctOption === String.fromCharCode(65 + optIndex) ? 'selected' : ''}>
                            Option ${String.fromCharCode(65 + optIndex)}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Points</label>
                <input type="number" class="form-control points-input" value="${question.points || 10}" min="1">
            </div>
            <div class="form-group">
                <label>Explanation (Optional)</label>
                <textarea class="form-control explanation-input" rows="2">${question.explanation || ''}</textarea>
            </div>
        </div>
    `;
    
    return div;
}

// Add new question
function addNewQuestion() {
    const newQuestion = {
        question: '',
        options: ['', '', '', ''],
        correctOption: 'A',
        points: 10,
        explanation: ''
    };
    
    const questionElement = createQuestionElement(newQuestion, questionsList.children.length);
    questionsList.insertBefore(questionElement, questionsList.lastChild);
}

// Edit question
function editQuestion(index) {
    const questionElement = document.querySelector(`.question-card[data-index="${index}"]`);
    questionElement.classList.toggle('editing');
}

// Delete question
async function deleteQuestion(index) {
    if (!currentQuiz || !currentQuiz.id) {
        showToast('No quiz selected', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
        showLoading();
        
        // Get the quiz document reference
        const quizRef = doc(db, 'quiz', currentQuiz.id);
        
        // Get the current questions array
        const questions = [...currentQuiz.questions];
        
        // Remove the question at the specified index
        questions.splice(index, 1);
        
        // Update the quiz document in Firebase
        await updateDoc(quizRef, {
            questions: questions,
            lastUpdated: serverTimestamp(),
            totalQuestions: questions.length
        });
        
        // Update local state
        currentQuiz.questions = questions;
        
        // Update UI
        const questionElement = document.querySelector(`.question-card[data-index="${index}"]`);
        if (questionElement) {
            questionElement.remove();
        }
        
        // Update indices for remaining questions
        document.querySelectorAll('.question-card').forEach((el, i) => {
            el.dataset.index = i;
        });
        
        showToast('Question deleted successfully');
        
        // If no questions left, show the no questions message
        if (questions.length === 0) {
            displayQuestions([]);
        }
        
    } catch (error) {
        console.error('Error deleting question:', error);
        showToast('Error deleting question. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Save all questions
async function saveQuestions() {
    if (!currentContestId) {
        showToast('Please select a contest first', 'error');
        return;
    }

    try {
        showLoading();
        
        // Collect all questions
        const questions = [];
        document.querySelectorAll('.question-card').forEach((element) => {
            const question = {
                question: element.querySelector('.question-text').value,
                options: Array.from(element.querySelectorAll('.option-input')).map(input => input.value),
                correctOption: element.querySelector('.correct-option').value,
                points: parseInt(element.querySelector('.points-input').value) || 10,
                explanation: element.querySelector('.explanation-input').value,
                type: 'MCQ'
            };
            
            // Validate question
            if (!question.question || question.options.some(opt => !opt)) {
                throw new Error('Please fill in all required fields for each question');
            }
            
            questions.push(question);
        });
        
        if (questions.length === 0) {
            throw new Error('Please add at least one question');
        }
        
        // Save to Firestore
        const result = await manageQuizDocument(currentContestId, questions);
        
        if (result.success) {
            showToast(result.message);
            await fetchQuizForContest(currentContestId);
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        console.error('Error saving questions:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Update manageQuizDocument to handle multiple questions
async function manageQuizDocument(contestId, questions) {
    if (!contestId) {
        console.error('Contest ID is required to save the quiz document.');
        return { success: false, message: 'Error: Contest ID is missing.' };
    }
    if (!questions || !Array.isArray(questions)) {
        console.error('Questions array is required to save the quiz document.');
        return { success: false, message: 'Error: Questions data is missing or invalid.' };
    }

    try {
        // Create a document reference with the contestId as the document ID
        const quizRef = doc(db, "quiz", contestId);

        const quizData = {
            contestId: contestId, // Store contestId as a field as well
            questions: questions,
            lastUpdated: serverTimestamp(),
            totalQuestions: questions.length,
            // Include createdAt only if it's a new document, or handle merge carefully
            // With merge: true, createdAt will be updated unless it's excluded.
            // If you want to keep the original createdAt on merge, fetch the doc first.
            // For simplicity, we'll update lastUpdated and keep createdAt implicitly if merging.
            // If this is the first time saving, serverTimestamp() will be set for createdAt.
            // If you need explicit createdAt setting only on creation, a get then set/update is needed.
            // Let's keep it simple and update lastUpdated every time.
        };

        // Use setDoc with { merge: true }.
        // If a document with this contestId exists, it will update the fields provided.
        // If no document with this contestId exists, it will create a new document with contestId as its ID.
        await setDoc(quizRef, quizData, { merge: true });

        // Check if it was an update or create for the message
        // This requires fetching the document BEFORE the setDoc if you need to know for sure.
        // For a simpler approach, we'll assume success and provide a generic message.
        console.log(`Quiz successfully saved/updated for contest ID: ${contestId}`);
        
        return {
            success: true,
            message: `✅ Quiz saved successfully for Contest ID: ${contestId}`
        };

    } catch (error) {
        console.error(`Error saving quiz for contest ID: ${contestId}`, error);
        return {
            success: false,
            message: `Error saving quiz: ${error.message}`
        };
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');
    initializeApp();
});

// Make functions available globally
window.editQuestion = editQuestion;
window.deleteQuestion = deleteQuestion;
window.addNewQuestion = addNewQuestion;
window.saveQuestions = saveQuestions; 