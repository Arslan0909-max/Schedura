export interface TimetableSlot {
  id: string;
  semester: string;       // e.g., "BBA Semester 1"
  section: string;        // e.g., "Section A"
  shift: 'Morning' | 'Evening';
  day: string;            // "Monday", "Tuesday", etc.
  timeSlot: string;       // "08:30 - 09:30"
  subject: string;        // "Financial Accounting"
  teacher: string;        // "Dr. Tariq Khan"
  room: string;           // "R-11"
  isBreak?: boolean;
  breakLabel?: string;
  color?: string;         // "indigo" | "blue" | "emerald" | "amber" | "rose" | "purple" | "teal"
}

export interface TimetableData {
  id: string;
  semester: string;
  section: string;
  shift: 'Morning' | 'Evening';
  days: string[];
  timeSlots: string[];
  slots: TimetableSlot[];
  createdAt: string;
  updatedAt: string;
}

export interface Conflict {
  id: string;
  type: 'room' | 'teacher' | 'section';
  severity: 'critical' | 'warning';
  title: string;
  description: string;
  slot1: TimetableSlot;
  slot2: TimetableSlot;
  suggestedResolution: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  step?: 'program' | 'teachers' | 'rooms' | 'breaks' | 'finalized';
  timetableData?: TimetableData | null;
  conflicts?: Conflict[];
  isVoice?: boolean;
  audioUrl?: string;
}

export interface UniversityTemplate {
  id: string;
  title: string;
  program: string;
  semester: string;
  sections: string[];
  shift: 'Morning' | 'Evening';
  days: string[];
  timeSlots: string[];
  teachers: { name: string; subject: string; room: string; color: string }[];
  breakSlot: string;
}
