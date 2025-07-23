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
        ui.title.textContent = `Results for Contest`; // Generic title
        ui.score.textContent = results.score;
        ui.correct.textContent = results.correct;
        ui.wrong.textContent = results.wrong;
        ui.time.textContent = `${results.timeTaken}s`;

        // Apply loser styling if applicable
        if (results.status === 'loser') {
            document.querySelector('.summary-card.score').classList.add('loser');
            document.querySelector('.summary-card.correct').classList.add('loser');
            document.querySelector('.summary-card.incorrect').classList.add('loser');
            document.querySelector('.summary-card.time').classList.add('loser');

            ui.title.textContent = 'Quiz Results (Loser)';
            ui.score.classList.add('loser-text');
            ui.correct.classList.add('loser-text');
            ui.wrong.classList.add('loser-text');
            ui.time.classList.add('loser-text');
        } else if (results.status === 'winner') {
            ui.title.textContent = 'Quiz Results (Winner)';
            // Add any specific winner styling here if needed
        }

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
            const contestRef = db.collection('contests').doc(state.contestId);
            const contestDoc = await contestRef.get();

            if (!contestDoc.exists) {
                return showError('Contest not found.');
            }

            const contestData = contestDoc.data();

            // Fetch user's personal result
            const userRef = db.collection('users').doc(state.currentUser.uid);
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                const contestResults = userData.contests || [];
                const resultData = contestResults.find(result =>
                    result.contestId === state.contestId
                );

                if (resultData) {
                    let displayStatus = 'completed'; // Default to completed
                    if (contestData.winnerDeclared === true) {
                        displayStatus = resultData.status || 'loser'; // Use actual status if winners declared
                    }

                    renderResults({
                        score: resultData.score || 0,
                        correct: resultData.correctQuestions || 0,
                        wrong: resultData.wrongQuestions || 0,
                        timeTaken: resultData.timeTaken || 0,
                        status: displayStatus,
                    });
                } else {
                    // User participated but no specific result found, or didn't participate
                    renderResults({
                        score: 0,
                        correct: 0,
                        wrong: 0,
                        timeTaken: 0,
                        status: 'loser',
                        prize: 0
                    });
                    console.log("No specific result found for this contest for the current user. Displaying as loser.");
                }
            } else {
                showError('User profile not found.');
            }

            // Display top performers if contest has participants
            if (contestData.participants && contestData.participants.length > 0) {
                await displayWinners(state.contestId);
            }

        } catch (error) {
            console.error("Error fetching results:", error);
            showError('An error occurred while fetching your results.');
        }
    };

    const displayWinners = async (contestId) => {
        const winnerInfoBox = document.getElementById('winner-info-box');
        const winnersListContainer = document.getElementById('winners-list-container');
        const winnersList = document.getElementById('winners-list');

        if (winnerInfoBox) winnerInfoBox.classList.add('hidden');
        winnersListContainer.classList.remove('hidden');
        winnersList.innerHTML = '<div class="loader"></div>'; // Show a loader

        try {
            const participantsCollectionRef = db.collection('contests').doc(contestId).collection('participants');
            const participantsSnapshot = await participantsCollectionRef.get();

            if (participantsSnapshot.empty) {
                winnersList.innerHTML = '<p>No participants found for this contest yet.</p>';
                return;
            }

            const allParticipantsPromises = participantsSnapshot.docs.map(async (participantDoc) => {
                const participantId = participantDoc.id;
                const userDoc = await db.collection('users').doc(participantId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const contestResult = userData.contests?.find(c => c.contestId === contestId);
                    if (contestResult) {
                        return {
                            userId: participantId,
                            name: userData.name || 'Anonymous',
                            score: contestResult.score || 0,
                            timeTaken: contestResult.timeTaken || 0,
                        };
                    }
                }
                return null;
            });

            const allParticipants = (await Promise.all(allParticipantsPromises)).filter(p => p !== null);

            allParticipants.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return a.timeTaken - b.timeTaken;
            });

            const topPerformers = allParticipants.slice(0, 3); // Get top 3

            winnersList.innerHTML = ''; // Clear loader

            if (topPerformers.length === 0) {
                winnersList.innerHTML = '<p>No top performers found yet.</p>';
                return;
            }

            topPerformers.forEach((participant, index) => {
                const stripe = document.createElement('div');
                stripe.className = `winner-stripe rank-${index + 1}`;

                const rank = document.createElement('div');
                rank.className = 'winner-rank';
                rank.innerHTML = `<span>#${index + 1}</span>`;

                if (index + 1 === 1) {
                    rank.innerHTML += '<i class="fas fa-medal gold"></i>';
                } else if (index + 1 === 2) {
                    rank.innerHTML += '<i class="fas fa-medal silver"></i>';
                } else if (index + 1 === 3) {
                    rank.innerHTML += '<i class="fas fa-medal bronze"></i>';
                }

                const details = document.createElement('div');
                details.className = 'winner-details';

                const name = document.createElement('div');
                name.className = 'winner-name';
                name.textContent = participant.name;

                const stats = document.createElement('div');
                stats.className = 'winner-stats';

                const scoreStat = document.createElement('div');
                scoreStat.className = 'winner-stat';
                scoreStat.innerHTML = '<span class="stat-label">Score</span><span class="stat-value">' + participant.score + '</span>';

                const timeStat = document.createElement('div');
                timeStat.className = 'winner-stat';
                timeStat.innerHTML = '<span class="stat-label">Time</span><span class="stat-value">' + participant.timeTaken + 's</span>';

                stats.appendChild(scoreStat);
                stats.appendChild(timeStat);

                details.appendChild(name);
                details.appendChild(stats);

                stripe.appendChild(rank);
                stripe.appendChild(details);

                winnersList.appendChild(stripe);
            });

        } catch (error) {
            console.error("Error displaying top performers:", error);
            winnersList.innerHTML = '<p>Could not load top performers information.</p>';
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