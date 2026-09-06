import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  getDocFromServer,
  getDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { TimetableData, ChatMessage } from '../types/timetable';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

/**
 * Validate connection to Firestore
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'timetables', '_ping_'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing.');
    }
    return false;
  }
}

/**
 * Auth state listener
 */
export function subscribeToAuthState(callback: (user: AppUser | null) => void) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'Academic Planner',
        photoURL: user.photoURL,
        isAnonymous: user.isAnonymous,
      });
    } else {
      callback(null);
    }
  });
}

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<AppUser> {
  const cred = await signInWithPopup(auth, googleProvider);
  const u = cred.user;
  const profile: AppUser = {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName || u.email?.split('@')[0] || 'User',
    photoURL: u.photoURL,
    isAnonymous: u.isAnonymous,
  };
  await saveUserProfile(profile);
  return profile;
}

/**
 * Sign up with Email & Password
 */
export async function registerWithEmail(email: string, pass: string, name?: string): Promise<AppUser> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  if (name && cred.user) {
    try {
      await updateProfile(cred.user, { displayName: name });
    } catch {}
  }
  const u = cred.user;
  const profile: AppUser = {
    uid: u.uid,
    email: u.email,
    displayName: name || u.displayName || email.split('@')[0],
    photoURL: u.photoURL,
    isAnonymous: u.isAnonymous,
  };
  await saveUserProfile(profile);
  return profile;
}

/**
 * Sign in with Email & Password
 */
export async function loginWithEmail(email: string, pass: string): Promise<AppUser> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  const u = cred.user;
  const profile: AppUser = {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName || email.split('@')[0],
    photoURL: u.photoURL,
    isAnonymous: u.isAnonymous,
  };
  await saveUserProfile(profile);
  return profile;
}

/**
 * Quick Guest / Anonymous access
 */
export async function loginAsGuest(): Promise<AppUser> {
  const cred = await signInAnonymously(auth);
  const u = cred.user;
  const profile: AppUser = {
    uid: u.uid,
    email: null,
    displayName: 'Guest Planner',
    photoURL: null,
    isAnonymous: true,
  };
  await saveUserProfile(profile);
  return profile;
}

/**
 * Sign out
 */
export async function logoutAppUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Save user profile to Firestore
 */
export async function saveUserProfile(user: AppUser): Promise<void> {
  try {
    const userDoc = doc(db, 'users', user.uid);
    await setDoc(
      userDoc,
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Could not save user profile to Firestore:', e);
  }
}

/**
 * Save or update a timetable in Firestore (both global and per-user)
 */
export async function saveTimetableToFirestore(timetable: TimetableData, userId?: string): Promise<void> {
  try {
    const docRef = doc(db, 'timetables', timetable.id);
    const enriched = {
      ...timetable,
      userId: userId || timetable.userId || auth.currentUser?.uid || 'guest',
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, enriched, { merge: true });

    // Also save in user's personal collection if logged in
    const currentUid = userId || auth.currentUser?.uid;
    if (currentUid) {
      const userTtRef = doc(db, 'users', currentUid, 'timetables', timetable.id);
      await setDoc(userTtRef, enriched, { merge: true });
    }
  } catch (err) {
    console.error('Failed to save timetable to Firestore:', err);
  }
}

/**
 * Fetch all stored timetables from Firestore
 */
export async function loadTimetablesFromFirestore(userId?: string): Promise<TimetableData[]> {
  try {
    const list: TimetableData[] = [];
    const currentUid = userId || auth.currentUser?.uid;

    if (currentUid) {
      try {
        const userTtCol = collection(db, 'users', currentUid, 'timetables');
        const userSnap = await getDocs(userTtCol);
        userSnap.forEach((d) => {
          list.push(d.data() as TimetableData);
        });
      } catch (err) {
        console.warn('Error loading user-specific timetables:', err);
      }
      return list;
    }

    return [];
  } catch (err) {
    console.error('Failed to load timetables from Firestore:', err);
    return [];
  }
}

/**
 * Delete a timetable from Firestore
 */
export async function deleteTimetableFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'timetables', id));
    const currentUid = auth.currentUser?.uid;
    if (currentUid) {
      try {
        await deleteDoc(doc(db, 'users', currentUid, 'timetables', id));
      } catch {}
    }
  } catch (err) {
    console.error('Failed to delete timetable from Firestore:', err);
  }
}

/**
 * Save chat messages to Firestore for persistent history
 */
export async function saveChatMessagesToFirestore(messages: ChatMessage[], userId?: string): Promise<void> {
  const currentUid = userId || auth.currentUser?.uid;
  if (!currentUid) return;

  try {
    const chatDocRef = doc(db, 'users', currentUid, 'chats', 'active_session');
    await setDoc(
      chatDocRef,
      {
        messages: messages.slice(-50),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Failed to save chat to Firestore:', e);
  }
}

/**
 * Load chat messages from Firestore
 */
export async function loadChatMessagesFromFirestore(userId?: string): Promise<ChatMessage[]> {
  const currentUid = userId || auth.currentUser?.uid;
  if (!currentUid) return [];

  try {
    const chatDocRef = doc(db, 'users', currentUid, 'chats', 'active_session');
    const snap = await getDoc(chatDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.messages)) {
        return data.messages as ChatMessage[];
      }
    }
  } catch (e) {
    console.warn('Failed to load chat from Firestore:', e);
  }
  return [];
}

