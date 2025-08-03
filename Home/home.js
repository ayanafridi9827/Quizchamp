// Firebase SDKs ko import kar rahe hain
// Ab hum Firebase ko global object se access karenge, imports ki zaroorat nahi

// Aapki Firebase project ki configuration details
const firebaseConfig = {
    apiKey: "AIzaSyBgCHdqzcsiB9VBTsv4O1fU2R88GVoOOyA",
    authDomain: "quizarena-c222d.firebaseapp.com",
    projectId: "quizarena-c222d",
    storageBucket: "quizarena-c222d.firebasestorage.app",
    messagingSenderId: "892135666693",
    appId: "1:892135666693:web:4f8bf849019603a937586c"
};

// Firebase ko initialize kar rahe hain
// Sirf ek baar initialize ho, iska dhyan rakhein
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Jab poora HTML page load ho jaye, tab yeh function chalega
document.addEventListener('DOMContentLoaded', () => {
    
    // HTML se zaroori elements ko select kar rahe hain
    const contestsGrid = document.querySelector('.all-contests-grid');
    const loadingState = document.querySelector('.loading-state');
    const errorState = document.querySelector('.error-state');
    const contestCardTemplate = document.getElementById('contest-card-template');
    const notification = document.getElementById('notification');

    let userCompletedContests = new Set(); // To store IDs of contests user has completed
    let userContestResults = new Map(); // To store user's rank and prize for completed contests
    let userWalletBalance = 0; // User ka wallet balance store karne ke liye
    let contestsLoaded = false; // Flag taki contests baar baar load na ho
    let currentUser = null;
    let userDataFetched = false; // Naya flag user data ko ek baar fetch karne ke liye

    let totalReads = 0;
    let totalWrites = 0;

    function logFirestoreOperation(type, count = 1) {
        if (type === 'read') {
            totalReads += count;
        } else if (type === 'write') {
            totalWrites += count;
        }
    }

    // Pagination variables
    let lastVisible = null;
    const pageSize = 10; // Ek baar me 10 contests load karenge

    // Function to show notifications
    function showNotification(message, type) {
        notification.textContent = message;
        notification.className = 'notification'; // Reset classes
        notification.classList.add(type, 'show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000); // Hide after 3 seconds
    }

    // Yeh function contest ka data lekar uska HTML card banata hai
    const createContestCard = (contestData, contestId, userCompletedContests) => {
        // Template se naya card clone kar rahe hain
        const card = contestCardTemplate.content.cloneNode(true).querySelector('.contest-card');

        // Aapke Firestore data ke hisaab se card ko bhar rahe hain
        card.querySelector('.contest-title').textContent = contestData.title || 'No Title';
        const prizeTextElement = card.querySelector('.prize-text');
        prizeTextElement.className = 'prize-info'; // Naye style ke liye class badal rahe hain
        prizeTextElement.innerHTML = `<span class="prize-label">PRIZE</span><span class="prize-amount">₹${contestData.prize || 0}</span>`;

        // Agar winner declare ho gaya hai, to prize amount ko green highlight karein
        if (contestData.winnerDeclared) {
            const prizeAmountSpan = prizeTextElement.querySelector('.prize-amount');
            if (prizeAmountSpan) {
                prizeAmountSpan.classList.add('winner-declared-prize');
            }
        }

        // Prize section ko contest-title ke theek neeche move kar rahe hain
        const prizeSection = card.querySelector('.prize-section');
        const contestTitle = card.querySelector('.contest-title');
        if (prizeSection && contestTitle) {
            contestTitle.parentNode.insertBefore(prizeSection, contestTitle.nextSibling);
        }

        card.querySelector('.entry-fee-text').textContent = `Entry: ₹${contestData.entryFee || 0}`;
        
        const spotsFilled = contestData.filledSpots || 0;
        const totalSpots = contestData.maxSpots || 0;
        card.querySelector('.spots-filled').textContent = `${spotsFilled} / ${totalSpots} spots`;

        // Progress bar update kar rahe hain
        const progressPercentage = totalSpots > 0 ? (spotsFilled / totalSpots) * 100 : 0;
        card.querySelector('.progress-fill').style.width = `${progressPercentage}%`;
        card.querySelector('.progress-percentage').textContent = `${Math.round(progressPercentage)}%`;
        card.querySelector('.progress-text').textContent = `${totalSpots - spotsFilled} spots left`;

        // Contest ka status (Live, Ended, etc.) set kar rahe hain
        const statusBadge = card.querySelector('.status-badge');
        if (contestData.status === 'active') {
            statusBadge.textContent = 'Live';
            statusBadge.classList.add('live');
        } else if (contestData.status === 'upcoming') {
            statusBadge.textContent = 'Upcoming';
            statusBadge.classList.add('upcoming');
        } else {
            statusBadge.textContent = 'Ended';
            statusBadge.classList.add('ended');
        }

        // Join button ka text aur link set kar rahe hain
        const joinBtn = card.querySelector('.join-btn');
        const joinTextSpan = joinBtn.querySelector('.join-text');

        // Define the click handler for joining a contest
        const joinButtonClickHandler = async () => {
            const entryFee = contestData.entryFee || 0;
            let newBalance; // Declare newBalance here

            if (userWalletBalance >= entryFee) {
                // Proceed to join contest
                if (!currentUser) {
                    showNotification("Please log in to join contest.", 'error');
                    return;
                }

                const walletRef = db.collection("wallets").doc(currentUser.uid);
                const contestRef = db.collection("contests").doc(contestId);

                try {
                    await db.runTransaction(async (transaction) => {
                        // Sabse pehle sab kuch padhein
                        console.log('Firestore Read: Wallet aur contest join karne ke liye fetch kar rahe hain', currentUser.uid, contestId);
                        const walletDoc = await transaction.get(walletRef);
                        logFirestoreOperation('read');
                        const contestDoc = await transaction.get(contestRef);
                        logFirestoreOperation('read');

                        // Padhe gaye data ke adhaar par jaanch karein
                        if (!walletDoc.exists) {
                            throw new Error("Wallet nahi mila! Kripya paise deposit karein.");
                        }
                        if (!contestDoc.exists) {
                            throw new Error("Contest nahi mila!");
                        }

                        const currentBalance = walletDoc.data().balance || 0;
                        if (currentBalance < entryFee) {
                            throw new Error("Aparyapt balance!");
                        }

                        newBalance = currentBalance - entryFee; // Assign value here
                        const newFilledSpots = (contestDoc.data().filledSpots || 0) + 1;

                        // Sabhi READS ke baad sabhi WRITES
                        // Wallet se entry fee kaate
                        transaction.update(walletRef, { balance: newBalance });
                        logFirestoreOperation('write');

                        // Contest document update karein: participant jodein aur filledSpots badhayein
                        transaction.update(contestRef, {
                            participants: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                            filledSpots: newFilledSpots
                        });
                        logFirestoreOperation('write');

                        // User document update karein: contest ko 'joined' ke roop mein add karein
                        const userRef = db.collection("users").doc(currentUser.uid);
                        transaction.update(userRef, {
                            contests: firebase.firestore.FieldValue.arrayUnion({
                                contestId: contestId,
                                joinedAt: new Date(),
                                isCompleted: false
                            })
                        });
                        logFirestoreOperation('write');
                    });

                    showNotification('Contest Joined Sucessfully', 'success');
                    // After successful join, update button to 'Continue'
                    joinTextSpan.textContent = 'Continue';
                    joinBtn.classList.add('joined');
                    // Remove join handler and add continue handler
                    joinBtn.removeEventListener('click', joinButtonClickHandler);
                    joinBtn.addEventListener('click', () => {
                        window.location.href = `/Home/quiz/quiz.html?contestId=${contestId}`;
                    });
                    userWalletBalance = newBalance; // Update the local balance variable

                } catch (error) {
                    console.error("Error joining contest:", error);
                    if (error.message === "Insufficient funds!") {
                        showNotification(`Insufficient funds! You need ₹${entryFee - userWalletBalance} more. Please deposit.`, 'error');
                    } else if (error.message === "Wallet not found! Please deposit funds.") {
                        showNotification("Wallet not found! Please deposit funds.", 'error');
                    } else {
                        showNotification(`Failed to join contest: ${error.message || 'Unknown error'}. Please try again.`, 'error');
                    }
                }
            } else {
                showNotification(`Insufficient funds! You need ₹${entryFee - userWalletBalance} more. Please deposit.`, 'error');
            }
        };

        // Check if user has already joined this contest
        const hasJoined = contestData.participants && contestData.participants.includes(currentUser.uid);
        const hasPlayedQuiz = userCompletedContests.has(contestId); // Check if user completed this contest
        const userResult = userContestResults.get(contestId); // Get user's specific result

        // If contest has ended and user has a result, display it
        if (contestData.winnerDeclared && userResult && userResult.status === 'winner') {
            card.classList.add('won-contest-card'); // Add class for styling

            // Hide unnecessary details
            card.querySelector('.contest-details').style.display = 'none';
            card.querySelector('.progress-section').style.display = 'none';
            card.querySelector('.contest-header').style.display = 'none'; // Hide original header

            // Update prize display to show user's prize
            prizeTextElement.innerHTML = `<span class="prize-label">You Won</span><span class="prize-amount winner-declared-prize">₹${userResult.prize || 0}</span>`;

            // Populate the new user-stats section
            const userStats = card.querySelector('.user-stats');
            userStats.innerHTML = `
                <div class="stat-item">
                    <i class="fas fa-trophy stat-icon"></i>
                    <div class="stat-info">
                        <span class="stat-label">Rank</span>
                        <span class="stat-value">#${userResult.rank || 'N/A'}</span>
                    </div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-star stat-icon"></i>
                    <div class="stat-info">
                        <span class="stat-label">Score</span>
                        <span class="stat-value">${userResult.score || 0}</span>
                    </div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-clock stat-icon"></i>
                    <div class="stat-info">
                        <span class="stat-label">Time</span>
                        <span class="stat-value">${formatTime(userResult.timeTaken)}</span>
                    </div>
                </div>
            `;
            userStats.style.display = 'flex'; // Make sure it's visible
            console.log('timeTaken value in createContestCard:', userResult.timeTaken);

            const congratsMessage = card.querySelector('.congrats-message');
            congratsMessage.textContent = 'Congratulations!';

            joinTextSpan.textContent = 'View Result';
            joinBtn.classList.add('view-result-btn');
            joinBtn.removeEventListener('click', joinButtonClickHandler); // Remove existing handler
            joinBtn.addEventListener('click', () => {
                window.location.href = `/Home/quiz/results.html?contestId=${contestId}`;
            });
        } else if (contestData.winnerDeclared && userResult && userResult.status === 'loser') {
            card.classList.add('loser-contest-card'); // Add class for styling

            // Hide unnecessary details
            card.querySelector('.contest-details').style.display = 'none';
            card.querySelector('.progress-section').style.display = 'none';
            card.querySelector('.contest-header').style.display = 'none'; // Hide original header

            // Update prize display to show 0 prize
            prizeTextElement.innerHTML = `<span class="prize-label">You Lost</span><span class="prize-amount loser-declared-prize">₹0.00</span>`;

            // Populate the new user-stats section
            const userStats = card.querySelector('.user-stats');
            userStats.innerHTML = `
                <div class="stat-item">
                    <i class="fas fa-star stat-icon"></i>
                    <div class="stat-info">
                        <span class="stat-label">Score</span>
                        <span class="stat-value">${userResult.score || 0}</span>
                    </div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-clock stat-icon"></i>
                    <div class="stat-info">
                        <span class="stat-label">Time</span>
                        <span class="stat-value">${formatTime(userResult.timeTaken)}</span>
                    </div>
                </div>
            `;
            userStats.style.display = 'flex'; // Make sure it's visible

            const loserMessage = card.querySelector('.loser-message');
            const quotes = [
                { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "- Winston Churchill" },
                { text: "Our greatest glory is not in never falling, but in rising every time we fall.", author: "- Confucius" },
                { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "- Thomas A. Edison" },
                { text: "It's fine to celebrate success but it is more important to heed the lessons of failure.", author: "- Bill Gates" }
            ];
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            loserMessage.innerHTML = `<p class="quote-text">"${randomQuote.text}"</p><p class="quote-author">${randomQuote.author}</p>`;
            loserMessage.style.display = 'block';

            joinTextSpan.textContent = 'View Result';
            joinBtn.classList.add('view-result-btn');
            joinBtn.removeEventListener('click', joinButtonClickHandler); // Remove existing handler
            joinBtn.addEventListener('click', () => {
                window.location.href = `/Home/quiz/results.html?contestId=${contestId}`;
            });
        } else if (contestData.winnerDeclared && userResult && userResult.status === 'loser') {
            card.classList.add('loser-contest-card'); // Add class for styling

            // Hide unnecessary details
            card.querySelector('.contest-details').style.display = 'none';
            card.querySelector('.progress-section').style.display = 'none';
            card.querySelector('.contest-header').style.display = 'none'; // Hide original header

            // Update prize display to show 0 prize
            prizeTextElement.innerHTML = `<span class="prize-label">You Lost</span><span class="prize-amount loser-declared-prize">₹0.00</span>`;

            // Populate the new user-stats section
            const userStats = card.querySelector('.user-stats');
            userStats.innerHTML = `
                <div class="stat-item">
                    <i class="fas fa-star stat-icon"></i>
                    <div class="stat-info">
                        <span class="stat-label">Score</span>
                        <span class="stat-value">${userResult.score || 0}</span>
                    </div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-clock stat-icon"></i>
                    <div class="stat-info">
                        <span class="stat-label">Time</span>
                        <span class="stat-value">${formatTime(userResult.timeTaken)}</span>
                    </div>
                </div>
            `;
            userStats.style.display = 'flex'; // Make sure it's visible

            const loserMessage = card.querySelector('.loser-message');
            const quotes = [
                { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "- Winston Churchill" },
                { text: "Our greatest glory is not in never falling, but in rising every time we fall.", author: "- Confucius" },
                { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "- Thomas A. Edison" },
                { text: "It's fine to celebrate success but it is more important to heed the lessons of failure.", author: "- Bill Gates" }
            ];
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            loserMessage.innerHTML = `<p class="quote-text">"${randomQuote.text}"</p><p class="quote-author">${randomQuote.author}</p>`;
            loserMessage.style.display = 'block';

            joinTextSpan.textContent = 'View Result';
            joinBtn.classList.add('view-result-btn');
            joinBtn.removeEventListener('click', joinButtonClickHandler); // Remove existing handler
            joinBtn.addEventListener('click', () => {
                window.location.href = `/Home/quiz/results.html?contestId=${contestId}`;
            });
        } else if (hasPlayedQuiz) {
            joinTextSpan.textContent = 'View Result';
            joinBtn.classList.add('view-result-btn'); // Add class for yellow background
            joinBtn.removeEventListener('click', joinButtonClickHandler); // Remove existing handler
            joinBtn.addEventListener('click', () => {
                window.location.href = `/Home/quiz/results.html?contestId=${contestId}`; // Redirect to results page
            });
        } else if (hasJoined) {
            joinTextSpan.textContent = 'Continue';
            joinBtn.classList.add('joined');
            joinBtn.removeEventListener('click', joinButtonClickHandler); // Remove existing handler
            joinBtn.addEventListener('click', () => {
                window.location.href = `/Home/quiz/quiz.html?contestId=${contestId}`;
            });
        } else {
            joinTextSpan.textContent = `Join for ₹${contestData.entryFee || 0}`;
            joinBtn.removeEventListener('click', joinButtonClickHandler); // Ensure no duplicate listeners
            joinBtn.addEventListener('click', joinButtonClickHandler); // Attach the named handler
        }

        // Pura taiyaar card lauta rahe hain
        return card;
    };

    // Function to format time (seconds to minutes and seconds)
    function formatTime(totalSeconds) {
        if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) {
            return 'N/A';
        }
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Yeh function contests ko load karta hai, pagination ke saath
    const loadContests = async () => {
        loadingState.style.display = 'flex'; // Show loading state
        errorState.style.display = 'none'; // Hide error state
        contestsGrid.innerHTML = ''; // Clear existing contests before loading new ones

        try {
            let contestsQuery = db.collection("contests").where("status", "in", ["active", "upcoming"]).limit(pageSize);
            if (lastVisible) {
                contestsQuery = contestsQuery.startAfter(lastVisible);
            }

            console.log('Firestore Read: Fetching contests with pagination');
            const querySnapshot = await contestsQuery.get();
            logFirestoreOperation('read', querySnapshot.size);
            
            loadingState.style.display = 'none'; // Hide loading state after data is fetched

            if (querySnapshot.empty && !contestsLoaded) {
                contestsGrid.innerHTML = '<p>No contests available right now. Check back later!</p>';
                contestsGrid.style.display = 'block';
                return;
            }

            querySnapshot.forEach(doc => {
                const contestCard = createContestCard(doc.data(), doc.id, userCompletedContests);
                contestsGrid.appendChild(contestCard);
            });

            // Update lastVisible for the next query
            lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

            // Show/hide Load More button
            const loadMoreBtn = document.getElementById('load-more-btn');
            if (querySnapshot.docs.length < pageSize) {
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            } else {
                if (loadMoreBtn) loadMoreBtn.style.display = 'block';
            }

            contestsGrid.style.display = 'grid';
            contestsLoaded = true; // Set to true after initial load

        }
        catch (error) {
            console.error("Error loading contests: ", error);
            loadingState.style.display = 'none'; // Hide loading state on error
            errorState.style.display = 'block'; // Show error state
            contestsLoaded = false; // Allow retry
        }
    };

    // User ke login status ko check kar rahe hain
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;

            if (!userDataFetched) {
                const userDocRef = db.collection("users").doc(user.uid);
                try {
                    const userDocSnap = await userDocRef.get();
                    logFirestoreOperation('read');

                    if (userDocSnap.exists) {
                        const userData = userDocSnap.data();
                        
                        // Wallet balance aur completed contests ki jaankari ab wallets collection se
                        const walletDocRef = db.collection("wallets").doc(user.uid);
                        const walletDocSnap = await walletDocRef.get();
                        logFirestoreOperation('read');

                        if (walletDocSnap.exists) {
                            userWalletBalance = walletDocSnap.data().balance || 0;
                        } else {
                            console.warn("Wallet document not found for user:", user.uid);
                            userWalletBalance = 0; // Default to 0 if wallet not found
                        }
                        if (userData.contests && Array.isArray(userData.contests)) {
                            for (const contest of userData.contests) {
                                if (contest.contestId && contest.isCompleted) {
                                    userCompletedContests.add(contest.contestId);
                                }
                                if (contest.contestId && (contest.status === 'winner' || contest.status === 'loser')) {
                                    console.log('Raw timeTaken from user data:', contest.timeTaken);
                                    userContestResults.set(contest.contestId, {
                                        rank: contest.rank,
                                        prize: contest.prize,
                                        score: contest.score, // Assuming score is also stored here
                                        timeTaken: contest.timeTaken ? contest.timeTaken : 'N/A',
                                        status: contest.status // Store the status
                                    });
                                }
                            }
                        }
                    } else {
                        // Agar user document nahi hai, toh logout karke login page par bhej do
                        // Kyunki login process mein document ban jana chahiye tha.
                        auth.signOut();
                        return;
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }

                userDataFetched = true;
            }

            if (!contestsLoaded) {
                contestsLoaded = true;
                loadContests();
            }
        } else {
            window.location.href = '/auth/login.html';
        }
    });

    // Retry button ka logic
    const retryBtn = document.querySelector('.retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            // Reset pagination for retry
            lastVisible = null;
            contestsGrid.innerHTML = ''; // Clear existing contests
            loadContests();
        });
    }

    // Load More button ka logic
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadContests);
    }

    // Mobile menu toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const overlay = document.querySelector('.overlay');

    if (mobileMenuBtn && navLinks && overlay) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            navLinks.classList.remove('active');
            overlay.classList.remove('active');
        });

        // Close menu when a nav link is clicked
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                overlay.classList.remove('active');
            });
        });
    }

});

    