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
        loader: getEl('loading-state'),
        content: getEl('results-content'),
        title: getEl('results-title'),
        score: getEl('final-score'),
        correct: getEl('correct-answers'),
        wrong: getEl('wrong-answers'),
        time: getEl('time-taken'),
        answersContainer: getEl('answers-container'),
        homeBtn: getEl('home-btn'),
    };

    // --- STATE ---
    let state = {
        currentUser: null,
        contestId: new URLSearchParams(window.location.search).get('contestId'),
    };

    // --- UI FUNCTIONS ---
    const renderResults = (results) => {
        const wrongAnswers = results.totalQuestions - results.correct;

        ui.title.textContent = `Results for Contest`; // Generic title
        ui.score.textContent = results.score;
        ui.correct.textContent = results.correct;
        ui.wrong.textContent = wrongAnswers > 0 ? wrongAnswers : 0;
        ui.time.textContent = `${results.timeTaken}s`;

        // Detailed answers section ko hata dein kyunki hum ab use save nahi kar rahe hain
        if (ui.answersContainer) {
            ui.answersContainer.style.display = 'none';
        }

        ui.loader.classList.add('hidden');
        ui.content.classList.remove('hidden');
    };

    const showError = (message) => {
        ui.loader.innerHTML = `<p>${message}</p>`;
    };

    // --- LOGIC ---
    const fetchResults = async () => {
        if (!state.contestId || !state.currentUser) {
            return showError('Could not retrieve results. Missing user or contest information.');
        }

        try {
            const userRef = db.collection('users').doc(state.currentUser.uid);
            console.log('Firestore Read: Fetching user document for quiz results:', state.currentUser.uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                return showError('User profile not found.');
            }

            const userData = userDoc.data();
            const contestResults = userData.contests || [];

            // Sahi contest ka result dhoondhein
            const resultData = contestResults.find(result => result.contestId === state.contestId);

            if (!resultData) {
                return showError('No results found for this specific contest.');
            }

            // resultData mein pehle se hi totalQuestions, score, etc. hain.
            // Seedhe renderResults ko call karein, lekin property names match karein.
            renderResults({
                score: resultData.score,
                correct: resultData.correctQuestions, // 'correct' property ke liye 'correctQuestions' use karein
                totalQuestions: resultData.totalQuestions,
                timeTaken: resultData.timeTaken
            });

        } catch (error) {
            console.error("Error fetching results:", error);
            showError('An error occurred while fetching your results.');
        }
    };

    // --- EVENT LISTENERS & BOOTSTRAP ---
    ui.homeBtn.addEventListener('click', () => {
        window.location.href = '/Home/home.html';
    });

    // Listen for auth state, but unsubscribe after the first result to prevent multiple runs.
    const unsubscribe = auth.onAuthStateChanged(user => {
        unsubscribe(); // Listener ko pehli call ke baad turant hata dein.
        if (user) {
            state.currentUser = user;
            fetchResults(); // Fetch results only once.
        } else {
            window.location.href = '/auth/login.html';
        }
    });
});