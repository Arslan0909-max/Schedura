import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  getDocFromServer,
} from 'firebase/firestore';
import { TimetableData } from '../types/timetable';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

/**
 * Validate connection to Firestore as per Firebase skill constraints
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
 * Save or update a timetable in Firestore
 */
export async function saveTimetableToFirestore(timetable: TimetableData): Promise<void> {
  try {
    const docRef = doc(db, 'timetables', timetable.id);
    await setDoc(docRef, timetable, { merge: true });
  } catch (err) {
    console.error('Failed to save timetable to Firestore:', err);
  }
}

/**
 * Fetch all stored timetables from Firestore
 */
export async function loadTimetablesFromFirestore(): Promise<TimetableData[]> {
  try {
    const colRef = collection(db, 'timetables');
    const snapshot = await getDocs(colRef);
    const list: TimetableData[] = [];
    snapshot.forEach((d) => {
      if (d.id !== '_ping_') {
        list.push(d.data() as TimetableData);
      }
    });
    return list;
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
  } catch (err) {
    console.error('Failed to delete timetable from Firestore:', err);
  }
}
