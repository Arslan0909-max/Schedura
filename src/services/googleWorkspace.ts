import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { TimetableData } from '../types/timetable';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let currentUser: User | null = null;

/**
 * Initialize workspace auth state
 */
export const initWorkspaceAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    currentUser = user;
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const getCachedUser = () => currentUser;
export const getCachedToken = () => cachedAccessToken;

/**
 * Sign in with Google with Spreadsheet and Calendar scopes
 */
export const signInWithGoogleWorkspace = async (): Promise<{ user: User; accessToken: string }> => {
  if (cachedAccessToken && currentUser) {
    return { user: currentUser, accessToken: cachedAccessToken };
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not retrieve access token from Google sign in');
    }
    cachedAccessToken = credential.accessToken;
    currentUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const signOutGoogleWorkspace = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  currentUser = null;
};

/**
 * Sync timetable directly to a new Google Spreadsheet
 */
export async function syncToGoogleSheets(
  timetable: TimetableData,
  token: string
): Promise<{ url: string; title: string }> {
  const title = `${timetable.semester} (${timetable.section}) - Timetable`;

  // 1. Create spreadsheet in user's Drive
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: {
            title: 'Schedule Matrix',
            gridProperties: {
              rowCount: timetable.timeSlots.length + 5,
              columnCount: timetable.days.length + 2,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Google Sheets API Error (${createRes.status}): ${errText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Build grid data
  const matrixData: string[][] = [];
  matrixData.push(['Time Slot', ...timetable.days]);

  timetable.timeSlots.forEach((slotTime) => {
    const row: string[] = [slotTime];
    timetable.days.forEach((day) => {
      const match = timetable.slots.find((s) => s.day === day && s.timeSlot === slotTime);
      if (match) {
        if (match.isBreak) {
          row.push(`[Break] ${match.subject}`);
        } else {
          const instructor = match.teacher ? ` - ${match.teacher}` : '';
          const room = match.room ? ` [${match.room}]` : '';
          row.push(`${match.subject}${instructor}${room}`);
        }
      } else {
        row.push('-');
      }
    });
    matrixData.push(row);
  });

  // 3. Write data to sheet
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Schedule%20Matrix!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: 'Schedule Matrix!A1',
        majorDimension: 'ROWS',
        values: matrixData,
      }),
    }
  );

  return { url: spreadsheetUrl, title };
}

/**
 * Sync all classes to Google Calendar as weekly recurring events
 */
export async function syncToGoogleCalendar(
  timetable: TimetableData,
  token: string
): Promise<{ count: number }> {
  const dayIndexMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const now = new Date();
  let createdCount = 0;

  for (const slot of timetable.slots) {
    if (slot.isBreak) continue;

    const targetDayIndex = dayIndexMap[slot.day] ?? 1;
    const daysUntil = (targetDayIndex - now.getDay() + 7) % 7;
    const eventDate = new Date(now);
    eventDate.setDate(now.getDate() + (daysUntil === 0 ? 7 : daysUntil));

    // Time parse
    const [startStr, endStr] = slot.timeSlot.split('-').map((s) => s.trim());
    const [startH, startM] = (startStr || '09:00').split(':').map(Number);
    const [endH, endM] = (endStr || '10:00').split(':').map(Number);

    const startDateTime = new Date(eventDate);
    startDateTime.setHours(startH || 9, startM || 0, 0, 0);

    const endDateTime = new Date(eventDate);
    endDateTime.setHours(endH || 10, endM || 0, 0, 0);

    const eventPayload = {
      summary: `${slot.subject} (${timetable.semester})`,
      description: `Course: ${slot.subject}\nInstructor: ${slot.teacher || 'Unassigned'}\nRoom: ${slot.room || 'TBA'}\nSection: ${timetable.section}\nShift: ${timetable.shift}`,
      location: slot.room || 'Main University Campus',
      start: {
        dateTime: startDateTime.toISOString(),
      },
      end: {
        dateTime: endDateTime.toISOString(),
      },
      recurrence: ['RRULE:FREQ=WEEKLY;COUNT=14'],
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (res.ok) {
      createdCount++;
    }
  }

  return { count: createdCount };
}
