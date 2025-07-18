// Import Firebase services from centralized config
import { auth, db } from './firebase-config.js';

// Import other Firebase functions
import {
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const contestListEl = document.getElementById('contest-list');
    const selectedContestTitleEl = document.getElementById('selected-contest-title');
    const questionsListEl = document.getElementById('questions-list');
    const addQuestionBtn = document.getElementById('add-question-btn');
    const saveQuizBtn = document.getElementById('save-quiz-btn');
    const modal = document.getElementById('add-edit-question-modal');
    const closeModalBtn = document.getElementById('close-question-modal');
    const questionForm = document.getElementById('add-edit-question-form');
    const logoutBtn = document.getElementById('logout-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    let contests = [];
    let quizzes = [];
    let currentContestId = null;
    let localQuestions = [];
    let editingQuestionIndex = null;

    // --- Toast & Loading ---
    const showToast = (message, type = 'success') => {
        toast.className = `toast ${type} show`;
        toastMessage.textContent = message;
        setTimeout(() => toast.classList.remove('show'), 3000);
    };

    const showLoading = (show) => loadingSpinner.classList.toggle('active', show);

    // --- Data Fetching ---
    const fetchData = async () => {
        showLoading(true);
        try {
            const [contestSnapshot, quizSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'contests'), orderBy('createdAt', 'desc'))),
                getDocs(collection(db, 'quiz'))
            ]);
            contests = contestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            quizzes = quizSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderContestList();
        } catch (error) {
            console.error("Error fetching data:", error);
            showToast("Failed to load data.", "error");
        } finally {
            showLoading(false);
        }
    };

    // --- UI Rendering ---
    const renderContestList = () => {
        contestListEl.innerHTML = '';
        const quizContestIds = new Set(quizzes.map(q => q.id));
        contests.forEach(contest => {
            const hasQuiz = quizContestIds.has(contest.id);
            const contestEl = document.createElement('div');
            contestEl.className = 'contest-item';
            contestEl.dataset.contestId = contest.id;
            contestEl.innerHTML = `
                <span class="contest-item-title">${contest.title}</span>
                ${hasQuiz ? '<span class="quiz-status-badge">Quiz Added</span>' : ''}
            `;
            contestEl.addEventListener('click', () => selectContest(contest, hasQuiz));
            contestListEl.appendChild(contestEl);
        });
    };

    const renderQuestions = () => {
        questionsListEl.innerHTML = '';
        if (localQuestions.length === 0) {
            questionsListEl.innerHTML = `<p>No questions yet. ${currentContestId ? 'Click "Add New Question" to start.' : ''}</p>`;
            return;
        }
        localQuestions.forEach((q, index) => {
            const card = document.createElement('div');
            card.className = 'question-card';
            card.innerHTML = `
                <div class="question-card-header">
                    <span class="question-number">Question ${index + 1}</span>
                    <div class="question-card-actions">
                        <button class="action-btn edit" onclick="event.stopPropagation(); window.editQuestion(${index})"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="event.stopPropagation(); window.deleteQuestion(${index})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <p>${q.question}</p>
                <div class="options-grid">
                    ${q.options.map((opt, i) => `<div class="option-item ${i === q.correctOption ? 'correct' : ''}">${opt}</div>`).join('')}
                </div>
            `;
            questionsListEl.appendChild(card);
        });
    };

    // --- Contest & Quiz Logic ---
    const selectContest = async (contest, hasQuiz) => {
        currentContestId = contest.id;
        document.querySelectorAll('.contest-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`.contest-item[data-contest-id="${contest.id}"]`).classList.add('active');
        selectedContestTitleEl.textContent = contest.title;
        addQuestionBtn.disabled = false;
        saveQuizBtn.disabled = false;

        if (hasQuiz) {
            const quiz = quizzes.find(q => q.id === contest.id);
            localQuestions = quiz ? [...quiz.questions] : [];
            addQuestionBtn.textContent = "Add New Question";
        } else {
            localQuestions = [];
            addQuestionBtn.textContent = "Create Quiz";
        }
        renderQuestions();
    };

    // --- Modal & Form ---
    const openModal = (question = null, index = null) => {
        editingQuestionIndex = index;
        questionForm.reset();
        document.getElementById('modal-title').textContent = index !== null ? 'Edit Question' : 'Add New Question';
        if (question) {
            document.getElementById('question-text').value = question.question;
            question.options.forEach((opt, i) => {
                document.getElementById(`option${i + 1}`).value = opt;
            });
            document.querySelector(`input[name="correct-option"][value="${question.correctOption}"]`).checked = true;
        }
        modal.style.display = 'flex'; // Ensure it's displayed
        // Force a reflow to ensure transition plays
        modal.offsetHeight;
        modal.classList.add('active');
    };

    const closeModal = () => {
        modal.classList.remove('active');
        // Wait for animation to complete before hiding
        setTimeout(() => {
            modal.style.display = 'none'; // Fully hide after transition
            questionForm.reset(); // Reset form fields
            editingQuestionIndex = null; // Clear editing state
        }, 300); // Match CSS transition duration
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        const question = {
            question: document.getElementById('question-text').value.trim(),
            options: [
                document.getElementById('option1').value.trim(),
                document.getElementById('option2').value.trim(),
                document.getElementById('option3').value.trim(),
                document.getElementById('option4').value.trim(),
            ],
            correctOption: parseInt(document.querySelector('input[name="correct-option"]:checked').value)
        };

        if (editingQuestionIndex !== null) {
            localQuestions[editingQuestionIndex] = question;
        } else {
            localQuestions.push(question);
        }
        renderQuestions();
        closeModal();
    };

    // --- CRUD Operations ---
    window.editQuestion = (index) => {
        openModal(localQuestions[index], index);
    };

    window.deleteQuestion = (index) => {
        if (confirm('Are you sure you want to delete this question?')) {
            localQuestions.splice(index, 1);
            renderQuestions();
        }
    };

    const saveQuiz = async () => {
        if (!currentContestId) {
            showToast("Please select a contest first.", "error");
            return;
        }
        showLoading(true);
        try {
            const quizRef = doc(db, 'quiz', currentContestId);
            await setDoc(quizRef, {
                contestId: currentContestId,
                questions: localQuestions,
                lastUpdated: serverTimestamp(),
                totalQuestions: localQuestions.length
            });
            showToast("Quiz saved successfully!");
            // Refetch data to update the contest list badge
            fetchData();
        } catch (error) {
            console.error("Error saving quiz:", error);
            showToast("Failed to save quiz.", "error");
        } finally {
            showLoading(false);
        }
    };

    // --- Event Listeners ---
    addQuestionBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    questionForm.addEventListener('submit', handleFormSubmit);
    saveQuizBtn.addEventListener('click', saveQuiz);
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = '../login.html');
    });

    // --- Initialization ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            fetchData();
        } else {
            window.location.href = '../login.html';
        }
    });
});