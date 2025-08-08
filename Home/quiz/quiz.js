document.addEventListener('DOMContentLoaded', () => {
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
            // This is the last question, so stop the timer immediately
            clearInterval(state.timerInterval);
            finishQuiz();
        }
    };

    const finishQuiz = async () => {
        // --- PREVENT DUPLICATE SUBMISSIONS ---
        ui.nextBtn.disabled = true;
        ui.nextBtn.textContent = 'Submitting...';
        // --- END PREVENT DUPLICATE SUBMISSIONS ---

        clearInterval(state.timerInterval);
        if (!state.currentUser) {
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

        const userContestResult = {
            contestId: state.contestId,
            score: finalScore,
            correctQuestions: correctQuestions,
            wrongQuestions: wrongQuestions,
            timeTaken: state.timeElapsed,
            completedAt: new Date(),
            isCompleted: true,
        };

        try {
            // --- Save Quiz Result Logic ---
            const userRef = db.collection('users').doc(state.currentUser.uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                throw new Error("User document not found while trying to save quiz results.");
            }

            const userData = userDoc.data();
            let contests = userData.contests || [];

            const contestIndex = contests.findIndex(
                c => c.contestId === state.contestId && c.isCompleted !== true
            );

            if (contestIndex > -1) {
                contests[contestIndex] = {
                    ...contests[contestIndex],
                    ...userContestResult
                };
            } else {
                contests.push(userContestResult);
            }

            await userRef.update({
                contests: contests
            });

            console.log("Quiz result successfully updated in the user's document!");

        } catch (error) {
            console.error("Error during quiz finalization:", error);
        } finally {
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
        if (!state.contestId || !state.currentUser) {
            return showError('No contest or user specified.');
        }

        // --- PRE-QUIZ CHECK ---
        // Check if the user has already completed this contest.
        try {
            const userRef = db.collection('users').doc(state.currentUser.uid);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                const contestHistory = userData.contests || [];
                const hasCompleted = contestHistory.some(c => c.contestId === state.contestId && c.isCompleted === true);

                if (hasCompleted) {
                    console.log("User has already completed this quiz. Redirecting to results.");
                    window.location.href = `results.html?contestId=${state.contestId}`;
                    return; // Stop further execution
                }
            }
        } catch (error) {
            console.error("Error checking contest completion status:", error);
            // Continue to load the quiz, but log the error.
        }
        // --- END PRE-QUIZ CHECK ---

        // --- LOAD QUIZ AND SESSION DATA ---
        try {
            const quizDoc = await db.collection('quiz').doc(state.contestId).get();
            if (!quizDoc.exists) return showError('Quiz data not found.');
            state.quizData = quizDoc.data();

            // Load time from session storage if it exists
            const savedTime = sessionStorage.getItem(`timeElapsed_${state.contestId}`);
            if (savedTime) {
                state.timeElapsed = parseInt(savedTime, 10);
            }

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
    };

    // --- EVENT LISTENERS & BOOTSTRAP ---
    ui.nextBtn.addEventListener('click', advanceQuiz);

    window.addEventListener('beforeunload', () => {
        // Stop the timer and save the current time before the page is unloaded
        if(state.timerInterval) {
            clearInterval(state.timerInterval);
            sessionStorage.setItem(`timeElapsed_${state.contestId}`, state.timeElapsed);
        }
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            state.currentUser = user;
            initializeQuiz();
        } else {
            window.location.href = '/auth/login.html';
        }
    });
});