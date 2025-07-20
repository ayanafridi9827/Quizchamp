document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired.');
    // --- CONFIG & INITIALIZATION ---
    const firebaseConfig = {
        apiKey: "AIzaSyBgCHdqzcsiB9VBTsv4O1fU2R88GVoOOyA",
        authDomain: "quizarena-c222d.firebaseapp.com",
        projectId: "quizarena-c222d",
        storageBucket: "quizarena-c222d.firebasestorage.app",
        messagingSenderId: "892135666693",
        appId: "1:892135666693:web:4f8bf849019603a937586c"
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- DOM ELEMENTS ---
    const getEl = (id) => document.getElementById(id);
    const ui = {
        title: getEl('quiz-title'),
        timer: getEl('timer'),
        loader: getEl('loading-state'),
        content: getEl('quiz-content'),
        counter: getEl('question-counter'),
        progress: getEl('progress-bar'),
        question: getEl('question-text'),
        options: getEl('options-container'),
        nextBtn: getEl('next-btn'),
    };

    // --- QUIZ STATE ---
    let state = {
        currentUser: null,
        contestId: new URLSearchParams(window.location.search).get('contestId'),
        quizData: null,
        currentQuestionIndex: 0,
        score: 0,
        timerInterval: null,
        userAnswers: [],
        selectedOption: null,
        timeElapsed: 0,
    };

    // --- UI UPDATE FUNCTIONS ---
    const renderQuestion = () => {
        ui.options.innerHTML = '';
        state.selectedOption = null;
        const question = state.quizData.questions[state.currentQuestionIndex];
        
        ui.counter.textContent = `Question ${state.currentQuestionIndex + 1} of ${state.quizData.questions.length}`;
        ui.progress.style.width = `${((state.currentQuestionIndex + 1) / state.quizData.questions.length) * 100}%`;
        ui.question.textContent = question.question;

        question.options.forEach(optionText => {
            const button = document.createElement('button');
            button.textContent = optionText;
            button.classList.add('option');
            button.onclick = () => handleOptionSelect(button, optionText);
            ui.options.appendChild(button);
        });

        ui.nextBtn.textContent = (state.currentQuestionIndex < state.quizData.questions.length - 1) 
            ? 'Next Question' 
            : 'Finish Quiz';
    };

    const updateTimer = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        ui.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    const showError = (message) => {
        ui.loader.innerHTML = `<p>${message}</p>`;
        ui.content.classList.add('hidden');
    };

    // --- LOGIC FUNCTIONS ---
    const handleOptionSelect = (button, selectedOption) => {
        Array.from(ui.options.children).forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        state.selectedOption = selectedOption;
    };

    const advanceQuiz = () => {
        if (!state.selectedOption) {
            alert("Please select an option before proceeding.");
            return;
        }

        const question = state.quizData.questions[state.currentQuestionIndex];
        const correctAnswer = question.options[question.correctOption];

        if (state.selectedOption === correctAnswer) {
            state.score++;
        }
        
        state.userAnswers.push({ 
            question: question.question, 
            selected: state.selectedOption, 
            correct: correctAnswer 
        });

        if (state.currentQuestionIndex < state.quizData.questions.length - 1) {
            state.currentQuestionIndex++;
            renderQuestion();
        } else {
            finishQuiz();
        }
    };

    const finishQuiz = async () => {
        clearInterval(state.timerInterval);
        if (!state.currentUser) {
            // Agar user logged in nahi hai, to purane tarike se redirect karein
            const url = `results.html?score=${state.score}&total=${state.quizData.questions.length}`;
            return window.location.href = url;
        }

        const totalQuestions = state.quizData.questions.length;
        let correctQuestions = 0;
        let wrongQuestions = 0;

        state.userAnswers.forEach(answer => {
            if (answer.selected === answer.correct) {
                correctQuestions++;
            } else {
                wrongQuestions++;
            }
        });

        const finalScore = (correctQuestions * 10) - (wrongQuestions * 10);

        // User ke contest result ka object banayein
        const userContestResult = {
            contestId: state.contestId,
            score: finalScore,
            correctQuestions: correctQuestions,
            wrongQuestions: wrongQuestions,
            timeTaken: state.timeElapsed, // Liya gaya samay
            completedAt: new Date(),
            isCompleted: true, // Keep isCompleted for tracking
        };

        try {
            const userRef = db.collection('users').doc(state.currentUser.uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                console.error("User document not found.");
                // Handle this case - maybe create the document or show an error
                return;
            }

            const userData = userDoc.data();
            let contests = userData.contests || [];

            // Find the index of the contest to update
            const contestIndex = contests.findIndex(
                c => c.contestId === state.contestId && c.isCompleted === false
            );

            if (contestIndex > -1) {
                // Update the existing contest entry
                contests[contestIndex] = {
                    ...contests[contestIndex], // Keep existing properties like joinedAt
                    ...userContestResult      // Overwrite with new results
                };
            } else {
                // If no incomplete contest is found, add the new result.
                // This might happen in some edge cases.
                contests.push(userContestResult);
            }

            // Update the entire contests array in Firestore
            await userRef.update({
                contests: contests
            });

            console.log("Quiz result successfully updated in the user's document!");

        } catch (error) {
            console.error("Error updating quiz result:", error);
            // Fallback logic can be added here
        } finally {
            // Redirect to the results page
            window.location.href = `results.html?contestId=${state.contestId}`;
        }
    };

    const startTimer = () => {
        state.timeElapsed = 0;
        updateTimer(state.timeElapsed);
        state.timerInterval = setInterval(() => {
            state.timeElapsed++;
            updateTimer(state.timeElapsed);
        }, 1000);
    };

    const initializeQuiz = async () => {
        console.log('>>> initializeQuiz: Function START <<<'); // DEBUG LOG
        if (!state.contestId) return showError('No contest specified.');

        try {
            console.log('Firestore Read: Fetching quiz data for contest:', state.contestId);
            const quizDoc = await db.collection('quiz').doc(state.contestId).get();
            if (!quizDoc.exists) return showError('Quiz data not found.');
            
            state.quizData = quizDoc.data();
            ui.title.textContent = state.quizData.title;
            
            ui.loader.classList.add('hidden');
            ui.content.classList.remove('hidden');
            ui.nextBtn.classList.remove('hidden');

            renderQuestion();
            startTimer();
        } catch (error) {
            console.error("Error fetching quiz data:", error);
            showError('Failed to load quiz.');
        }
        console.log('>>> initializeQuiz: Function END <<<'); // DEBUG LOG
    };

    // --- EVENT LISTENERS & BOOTSTRAP ---
    ui.nextBtn.addEventListener('click', advanceQuiz);

    let quizInitialized = false; // Flag to prevent re-initialization
    auth.onAuthStateChanged(user => {
        console.log('onAuthStateChanged fired.');
        if (user) {
            state.currentUser = user;
            console.log('User is logged in:', user.uid);
            if (!quizInitialized) {
                console.log('Initializing quiz...');
                initializeQuiz();
                quizInitialized = true;
            } else {
                console.log('Quiz already initialized, skipping.');
            }
        } else {
            console.log('User is not logged in, redirecting.');
            window.location.href = '/auth/login.html';
        }
    });
});