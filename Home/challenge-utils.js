import { 
    collection, 
    doc, 
    getDoc, 
    runTransaction, 
    arrayUnion,
    serverTimestamp,
    getFirestore
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

        return await runTransaction(db, async (transaction) => {
            // Get challenge document
            const challengeDoc = await transaction.get(challengeRef);
            if (!challengeDoc.exists()) {
                throw new Error('Challenge not found');
            }

            const challengeData = challengeDoc.data();
            
            // Check if challenge is active
            if (challengeData.status !== 'active') {
                return {
                    success: false,
                    message: 'This challenge is no longer active'
                };
            }

            // Check if challenge is full
            if (challengeData.participants && challengeData.participants.length >= challengeData.maxSpots) {
                return {
                    success: false,
                    message: 'Sorry, this challenge is full!'
                };
            }

            // Get user document
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();

            // Check if user has already joined
            if (challengeData.participants && challengeData.participants.includes(userId)) {
                return {
                    success: false,
                    message: 'You have already joined this challenge!'
                };
            }

            // Update challenge document
            transaction.update(challengeRef, {
                participants: arrayUnion(userId),
                lastUpdated: serverTimestamp()
            });

            // Update user's challenge history
            const challengeHistory = {
                challengeId: challengeId,
                challengeTitle: challengeData.title,
                joinedAt: new Date().toISOString(),
                status: 'active',
                prize: challengeData.prize,
                entryFee: challengeData.entryFee,
                subject: challengeData.subject
            };

            transaction.update(userRef, {
                challengeHistory: arrayUnion(challengeHistory),
                lastUpdated: serverTimestamp()
            });

            return {
                success: true,
                message: 'Successfully joined the challenge!'
            };
        });
    } catch (error) {
        console.error('Error joining challenge:', error);
        return {
            success: false,
            message: 'Failed to join challenge. Please try again.'
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
            return [];
        }

        const userData = userDoc.data();
        return userData.challengeHistory || [];
    } catch (error) {
        console.error('Error getting user challenge history:', error);
        return [];
    }
} 