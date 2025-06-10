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

// New Question Modal Elements
let addEditQuestionModal;
let modalTitle;
let closeQuestionModal;
let addEditQuestionForm;
let questionIdInput;
let questionTextInput;
let optionInputs = []; // Array to hold option input elements
let correctOptionRadios = []; // Array to hold correct option radio buttons
let timeLimitInput;

// State management
let currentContestId = null;
let currentQuiz = null;
let allContests = [];
let allQuizzes = [];

// Initialize DOM elements
function initializeElements() {
    try {
        // Initialize main elements
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

        // Initialize modal elements
        addEditQuestionModal = document.getElementById('add-edit-question-modal');
        modalTitle = document.getElementById('modal-title');
        closeQuestionModal = document.getElementById('close-question-modal');
        addEditQuestionForm = document.getElementById('add-edit-question-form');
        questionIdInput = document.getElementById('question-id');
        questionTextInput = document.getElementById('question-text');

        // Initialize option inputs and radio buttons
        optionInputs = [
            document.getElementById('option1'),
            document.getElementById('option2'),
            document.getElementById('option3'),
            document.getElementById('option4')
        ];

        correctOptionRadios = Array.from(document.querySelectorAll('input[name="correct-option"]'));

        // Validate all elements are found
        const elements = {
            contestList,
            selectedContestTitle,
            selectedContestDates,
            questionsList,
            loadingSpinner,
            toast,
            toastMessage,
            saveQuizBtn,
            addQuestionBtn,
            logoutBtn,
            addEditQuestionModal,
            modalTitle,
            closeQuestionModal,
            addEditQuestionForm,
            questionIdInput,
            questionTextInput
        };

        const missingElements = Object.entries(elements)
            .filter(([_, element]) => !element)
            .map(([name]) => name);

        if (missingElements.length > 0) {
            throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
        }

        if (optionInputs.some(input => !input)) {
            throw new Error('One or more option input elements not found');
        }

        if (correctOptionRadios.length !== 4) {
            throw new Error('Expected 4 correct option radio buttons, found ' + correctOptionRadios.length);
        }

        return true;
    } catch (error) {
        console.error('Error initializing elements:', error);
        return false;
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Save quiz button
    saveQuizBtn.addEventListener('click', saveQuestions);

    // Add question button
    addQuestionBtn.addEventListener('click', () => {
        if (!currentContestId) {
            showToast('Please select a contest first to add a question.', 'error');
            return;
        }
        openQuestionModal();
    });

    // Close question modal button
    closeQuestionModal.addEventListener('click', closeQuestionModalHandler);

    // Close modal when clicking outside
    addEditQuestionModal.addEventListener('click', (e) => {
        if (e.target === addEditQuestionModal) {
            closeQuestionModalHandler();
        }
    });

    // Save question form submission
    addEditQuestionForm.addEventListener('submit', saveQuestionFromModal);

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

// Show global loading spinner and disable buttons
function showLoading() {
    loadingSpinner.classList.add('active');
    // Display a spinner inside the questions list as well
    questionsList.innerHTML = '<div class="loading-spinner active"><div class="spinner"></div></div>';
    saveQuizBtn.disabled = true;
    addQuestionBtn.disabled = true;
}

// Hide global loading spinner and enable buttons
function hideLoading() {
    loadingSpinner.classList.remove('active');
    // Only enable if a contest is selected
    if (currentContestId) {
        saveQuizBtn.disabled = false;
        addQuestionBtn.disabled = false;
    }
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
        // The loading spinner inside contest-list is handled by HTML initial state.
        // We clear it here after data is loaded.
        console.log('Fetching contests...');
        
        const contestsQuery = query(
            collection(db, 'contests'),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(contestsQuery);
        console.log('Contests fetched:', snapshot.size);
        
        contestList.innerHTML = ''; // Clear initial loading spinner
        
        if (snapshot.empty) {
            console.log('No contests found');
            contestList.innerHTML = `
                <div class="no-contests">
                    <i class="fas fa-trophy"></i>
                    <p>No contests found</p>
                    <small>Create a contest to add quiz questions</small>
                </div>
            `;
            // Disable question-related buttons if no contests
            saveQuizBtn.disabled = true;
            addQuestionBtn.disabled = true;
            questionsList.innerHTML = `
                <div class="no-questions" id="no-questions-message">
                    <i class="fas fa-file-alt"></i>
                    <p>No questions to display. Select a contest or add a new question.</p>
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
            
            // Format dates (using startTime/endTime from challenges.js context)
            const startDate = contest.startTime ? new Date(contest.startTime.toDate()).toLocaleDateString() : 'Not set';
            const endDate = contest.endTime ? new Date(contest.endTime.toDate()).toLocaleDateString() : 'Not set';
            
            // Set contest status
            let status = 'draft';
            const now = new Date();
            if (contest.startTime && contest.endTime) {
                if (now < contest.startTime.toDate()) {
                    status = 'upcoming';
                } else if (now > contest.endTime.toDate()) {
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
                
                // Enable buttons related to questions
                saveQuizBtn.disabled = false;
                addQuestionBtn.disabled = false;

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
        // The loading state for the contest list is handled by replacing innerHTML
        // The global loading spinner is not used here for initial contest fetch.
    }
}

// Fetch quiz for selected contest
async function fetchQuizForContest(contestId) {
    try {
        showLoading(); // Show global loading spinner and questionsList spinner
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
            displayQuestions([]); // Show no questions message
        }
    } catch (error) {
        console.error('Error fetching quiz:', error);
        showToast('Error loading quiz. Please try again.', 'error');
        questionsList.innerHTML = `
            <div class="no-questions">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading questions</p>
                <small>Please try again later</small>
            </div>
        `;
    } finally {
        hideLoading(); // Hide global loading spinner
    }
}

// Display questions in the list
function displayQuestions(questions) {
    questionsList.innerHTML = ''; // Clear previous questions
    
    if (!questions || questions.length === 0) {
        const noQuestionsMessage = document.getElementById('no-questions-message');
        if (noQuestionsMessage) {
            questionsList.appendChild(noQuestionsMessage); // Append the pre-existing message
        } else {
            // Fallback if the element is not found for some reason (shouldn't happen with proper HTML)
            questionsList.innerHTML = `
                <div class="no-questions">
                    <i class="fas fa-file-alt"></i>
                    <p>No questions to display. Click "Add New Question" to create your first question.</p>
                </div>
            `;
        }
        saveQuizBtn.disabled = true; // Disable save button if no questions
        return;
    }
    
    saveQuizBtn.disabled = false; // Enable save button if questions are present

    questions.forEach((question, index) => {
        const questionElement = createQuestionElement(question, index);
        questionsList.appendChild(questionElement);
    });
}

// Create question element (display-only for main list)
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
            <p>${question.question}</p>
            <div class="options-grid">
                ${question.options.map((option, optIndex) => `
                    <div class="option-item ${optIndex === (question.correctOption || 0) ? 'correct' : ''}">
                        <i class="fas ${optIndex === (question.correctOption || 0) ? 'fa-check-circle' : 'fa-circle'}"></i>
                        <span>${String.fromCharCode(65 + optIndex)}. ${option}</span>
                    </div>
                `).join('')}
            </div>
            <div class="question-meta">
                <span><i class="fas fa-coins"></i> ${question.points || 10} points</span>
            </div>
        </div>
    `;
    
    return div;
}

// Open Add/Edit Question Modal
function openQuestionModal(question = null, index = -1) {
    if (!currentContestId) {
        showToast('Please select a contest first to add a question.', 'error');
        return;
    }

    // Reset form and modal state
    addEditQuestionForm.reset();
    questionIdInput.value = '';
    modalTitle.innerHTML = '<i class="fas fa-question-circle"></i> Add New Question';
    
    // Reset correct option radio buttons
    correctOptionRadios.forEach(radio => radio.checked = false);
    
    // Set default correct option for new questions
    if (correctOptionRadios[0]) {
        correctOptionRadios[0].checked = true;
        correctOptionRadios[0].required = true;
    }

    if (question) {
        // Editing existing question
        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Question';
        questionIdInput.value = index;
        questionTextInput.value = question.question;
        
        // Set option values
        optionInputs.forEach((input, i) => {
            input.value = question.options[i] || '';
        });
        
        // Set correct option
        if (correctOptionRadios[question.correctOption]) {
            correctOptionRadios[question.correctOption].checked = true;
        }
    }

    // Show modal with animation
    addEditQuestionModal.style.display = 'flex';
    // Force a reflow
    addEditQuestionModal.offsetHeight;
    addEditQuestionModal.classList.add('active');
}

// Close Add/Edit Question Modal
function closeQuestionModalHandler() {
    addEditQuestionModal.classList.remove('active');
    // Wait for animation to complete before hiding
    setTimeout(() => {
        addEditQuestionModal.style.display = 'none';
        addEditQuestionForm.reset();
        questionIdInput.value = '';
    }, 300);
}

// Save Question from Modal
async function saveQuestionFromModal(event) {
    event.preventDefault();

    if (!currentContestId) {
        showToast('Error: No contest selected.', 'error');
        return;
    }
    
    try {
        showLoading();
        
        const questionText = questionTextInput.value.trim();
        const options = optionInputs.map(input => input.value.trim());
        const selectedCorrectOptionRadio = correctOptionRadios.find(radio => radio.checked);
        const correctOptionIndex = selectedCorrectOptionRadio ? parseInt(selectedCorrectOptionRadio.value) : -1;

        // Basic validation
        if (!questionText || options.some(opt => !opt) || correctOptionIndex === -1) {
            showToast('Please fill in all question fields and select a correct option.', 'error');
            hideLoading();
            return;
        }

        const newQuestion = {
            question: questionText,
            options: options,
            correctOption: correctOptionIndex, // Store as index (0, 1, 2, 3)
            points: 10, // Default points, can be made configurable later
            type: 'MCQ', // Assuming MCQ for now
            createdAt: serverTimestamp()
        };

        if (currentQuiz) {
            // Quiz document already exists for this contest, update it.
            const questions = [...currentQuiz.questions]; // Create a mutable copy
            const questionIndex = questionIdInput.value;

            if (questionIndex !== '') {
                // Editing existing question
                questions[questionIndex] = { ...questions[questionIndex], ...newQuestion, updatedAt: serverTimestamp() };
                showToast('Question updated successfully!', 'success');
            } else {
                // Adding new question
                questions.push(newQuestion);
                showToast('Question added successfully!', 'success');
            }
            currentQuiz.questions = questions; // Update local state
        } else {
            // No quiz document for this contest yet, create a new one.
            currentQuiz = {
                contestId: currentContestId,
                questions: [newQuestion],
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp(),
                totalQuestions: 1
            };
            showToast('New quiz created and question added successfully!', 'success');
        }

        // Save/Update the quiz document in Firestore
        const result = await manageQuizDocument(currentContestId, currentQuiz.questions);

        if (result.success) {
            displayQuestions(currentQuiz.questions); // Refresh display with updated local state
            closeQuestionModalHandler(); // Close the modal
        } else {
            showToast(result.message, 'error');
        }
        
    } catch (error) {
        console.error('Error saving question from modal:', error);
        showToast('An error occurred while saving the question.', 'error');
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
        
        // Use currentQuiz.questions directly as it's updated by modal saves
        const questionsToSave = currentQuiz ? currentQuiz.questions : [];
        
        if (questionsToSave.length === 0) {
            throw new Error('Please add at least one question');
        }
        
        // Save to Firestore
        const result = await manageQuizDocument(currentContestId, questionsToSave);
        
        if (result.success) {
            showToast(result.message);
            // Refresh display from currentQuiz.questions, no need to refetch from Firestore unless data integrity is crucial.
            displayQuestions(currentQuiz.questions);
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
        const quizRef = doc(db, 'quiz', contestId);

        const quizData = {
            contestId: contestId, // Store contestId as a field as well
            questions: questions,
            lastUpdated: serverTimestamp(),
            totalQuestions: questions.length,
        };

        await setDoc(quizRef, quizData, { merge: true });

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

// Delete question
async function deleteQuestion(index) {
    if (!currentQuiz || !currentQuiz.id) {
        showToast('No quiz selected or quiz ID missing', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
        showLoading();
        
        // Get the current questions array from local state
        const questions = [...currentQuiz.questions];
        
        // Remove the question at the specified index
        questions.splice(index, 1);
        
        // Update local state
        currentQuiz.questions = questions; // Update currentQuiz with the modified array
        currentQuiz.totalQuestions = questions.length; // Update totalQuestions
        
        // Update the quiz document in Firebase using the local state
        const quizRef = doc(db, 'quiz', currentQuiz.id);
        await updateDoc(quizRef, {
            questions: currentQuiz.questions,
            lastUpdated: serverTimestamp(),
            totalQuestions: currentQuiz.totalQuestions
        });
        
        // Update UI
        displayQuestions(currentQuiz.questions); // Re-render questions based on updated local state
        
        showToast('Question deleted successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting question:', error);
        showToast(error.message || 'Error deleting question. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');
    initializeApp();
});

// Make functions available globally
window.editQuestion = (index) => {
    if (!currentQuiz || !currentQuiz.questions || !currentQuiz.questions[index]) {
        showToast('Question not found for editing.', 'error');
        return;
    }
    openQuestionModal(currentQuiz.questions[index], index);
};

window.addNewQuestion = () => {
    if (!currentContestId) {
        showToast('Please select a contest first to add a question.', 'error');
        return;
    }
    openQuestionModal();
};

window.saveQuestions = saveQuestions;
window.deleteQuestion = deleteQuestion; 