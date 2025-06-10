import { 
    collection, 
    doc, 
    getDoc, 
    runTransaction, 
    arrayUnion,
    serverTimestamp,
    getFirestore,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth } from './firebase-config.js';

// Get Firestore instance
const db = getFirestore();

// Function to join a challenge
export async function joinChallenge(challengeId) {
    try {
        const user = auth.currentUser;
        
        if (!user) {
            return {
                success: false,
                message: 'Please sign in to join the challenge'
            };
        }

        const userId = user.uid;
        const challengeRef = doc(db, 'contests', challengeId);
        const userRef = doc(db, 'users', userId);

        // Use a transaction to ensure atomicity
        return await runTransaction(db, async (transaction) => {
            // Get challenge document
            const challengeDoc = await transaction.get(challengeRef);
            if (!challengeDoc.exists()) {
                console.warn('Contest document not found:', challengeId);
                return {
                    success: false,
                    message: 'Contest not found'
                };
            }

            const challengeData = challengeDoc.data();
            
            // Check if challenge is active (optional, based on your game flow)
            // if (challengeData.status !== 'active') {
            //     return {
            //         success: false,
            //         message: 'This contest is no longer active'
            //     };
            // }

            // Check if challenge is full
            if (challengeData.participants?.length >= challengeData.maxSpots) {
                return {
                    success: false,
                    message: 'Sorry, this contest is full!'
                };
            }

            // Get user document
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                 console.warn('User document not found:', userId);
                throw new Error('User not found'); // This shouldn't happen if user is authenticated, but good check
            }

            const userData = userDoc.data();
            const challengeHistoryArray = Array.isArray(userData.challengeHistory) ? userData.challengeHistory : [];

            // Check if user has already joined by looking at the participants array on the contest
            if (challengeData.participants?.includes(userId)) {
                 console.log('User already in participants array for contest:', challengeId);
                return {
                    success: false,
                    message: 'You have already joined this contest!'
                };
            }
            
            // --- Update user's challengeHistory ---
            // Find if a history entry for this contest already exists
            const existingHistoryEntryIndex = challengeHistoryArray.findIndex(entry => entry.contestId === challengeId);

            const newHistoryEntry = {
                 // Copy existing properties if updating an existing entry
                 ...(existingHistoryEntryIndex !== -1 ? challengeHistoryArray[existingHistoryEntryIndex] : {}),

                contestId: challengeId,
                // Set joinedAt only if it doesn't exist (for the first join click)
                 joinedAt: existingHistoryEntryIndex !== -1 && challengeHistoryArray[existingHistoryEntryIndex].joinedAt 
                           ? challengeHistoryArray[existingHistoryEntryIndex].joinedAt 
                           : Timestamp.now(),
                status: 'joined', // Initial status when joining
                // You can add other initial fields here if needed (e.g., score: 0, etc.)
                 // Ensure required fields are present even if it's a new entry
                score: challengeHistoryArray[existingHistoryEntryIndex]?.score || 0,
                correct: challengeHistoryArray[existingHistoryEntryIndex]?.correct || 0,
                wrong: challengeHistoryArray[existingHistoryEntryIndex]?.wrong || 0,
                timeTaken: challengeHistoryArray[existingHistoryEntryIndex]?.timeTaken || 0,
                 completedAt: challengeHistoryArray[existingHistoryEntryIndex]?.completedAt || null

            };
            
            let updatedHistoryArray = [...challengeHistoryArray]; // Create a copy

            if (existingHistoryEntryIndex !== -1) {
                // Update the existing entry
                updatedHistoryArray[existingHistoryEntryIndex] = newHistoryEntry;
            } else {
                // Add the new entry
                updatedHistoryArray.push(newHistoryEntry);
            }

            transaction.update(userRef, {
                challengeHistory: updatedHistoryArray,
                lastUpdated: serverTimestamp()
            });
            
            // Update challenge document - add user to participants array
            transaction.update(challengeRef, {
                participants: arrayUnion(userId),
                lastUpdated: serverTimestamp()
            });

            console.log(`User ${userId} joined contest ${challengeId}. Challenge history and participants updated.`);

            return {
                success: true,
                message: 'Successfully joined the contest!'
            };
        });
    } catch (error) {
        console.error('Error joining contest:', error);
        return {
            success: false,
            message: 'Failed to join contest. Please try again.'
        };
    }
}

// Function to check if user has joined a challenge
export async function hasJoinedChallenge(challengeId) {
    try {
        const user = auth.currentUser;
        
        if (!user) {
            return false;
        }

        const userId = user.uid;
        const challengeRef = doc(db, 'contests', challengeId);
        const challengeDoc = await getDoc(challengeRef);

        if (!challengeDoc.exists()) {
            console.warn('Challenge not found when checking join status:', challengeId);
            return false;
        }

        const challengeData = challengeDoc.data();
        return challengeData.participants && challengeData.participants.includes(userId);
    } catch (error) {
        console.error('Error checking challenge join status:', error);
        return false;
    }
}

// Function to get user's challenge history
export async function getUserChallengeHistory() {
    try {
        const user = auth.currentUser;
        
        if (!user) {
            return [];
        }

        const userId = user.uid;
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            console.warn('User document not found when getting challenge history:', userId);
            return [];
        }

        const userData = userDoc.data();
        return Array.isArray(userData.challengeHistory) ? userData.challengeHistory : [];
    } catch (error) {
        console.error('Error getting user challenge history:', error);
        return [];
    }
} 