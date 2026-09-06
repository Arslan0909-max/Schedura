import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { memoryService } from './memoryService';

const renderTimetableDeclaration: FunctionDeclaration = {
  name: 'render_timetable_to_canvas',
  description:
    'Renders or updates the live visual timetable grid on the right-side WorkSpace canvas. Call this tool automatically whenever the user provides timetable information or asks to create/update/finalize a schedule.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      semester: {
        type: Type.STRING,
        description: 'Semester name, e.g. "BBA Semester 1" or "BSCS Semester 3"',
      },
      section: {
        type: Type.STRING,
        description: 'Section name, e.g. "Section A" or "Section B"',
      },
      shift: {
        type: Type.STRING,
        description: 'Shift, e.g. "Morning" or "Evening"',
      },
      days: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Active days of the week (e.g. ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])',
      },
      timeSlots: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          'Time slot intervals in order, e.g. ["08:30 - 09:30", "09:30 - 10:30", "10:30 - 11:30", "11:30 - 12:00", "12:00 - 01:00", "01:00 - 02:00"]',
      },
      slots: {
        type: Type.ARRAY,
        description: 'List of scheduled classes and breaks',
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.STRING, description: 'Day of week, e.g. "Monday"' },
            timeSlot: { type: Type.STRING, description: 'Exact time slot string matching timeSlots array' },
            subject: { type: Type.STRING, description: 'Course/Subject title, e.g. "Financial Accounting"' },
            teacher: { type: Type.STRING, description: 'Teacher/Professor name, e.g. "Dr. Tariq Khan"' },
            room: { type: Type.STRING, description: 'Room number or lab, e.g. "R-11"' },
            isBreak: { type: Type.BOOLEAN, description: 'Whether this slot is a break/recess/prayer' },
            breakLabel: { type: Type.STRING, description: 'Label if it is a break, e.g. "Break & Prayer"' },
            color: {
              type: Type.STRING,
              description: 'Pastel accent color code, e.g. "blue", "indigo", "emerald", "amber", "rose", "purple", "cyan"',
            },
          },
          required: ['day', 'timeSlot'],
        },
      },
      conflictNotes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Any clash notes detected or automatically resolved during scheduling',
      },
    },
    required: ['semester', 'section', 'days', 'timeSlots', 'slots'],
  },
};

const SYSTEM_PROMPT = `
You are 'Schedura', an elite AI Full-Stack University Timetable Engineer and Academic Scheduler.
Your personality is razor-sharp, witty, confident, and deeply intelligent (inspired by Grok and Sigma energy: high IQ, zero fluff, slightly savage yet deeply helpful and friendly).

PERSONALITY & ADAPTIVE TONE ENGINE:
1. ADAPTIVE TONE MIRRORING (CRITICAL):
   - Dynamically mirror the user's language, vocabulary, and vibe!
   - If the user uses casual, slang, or Roman Urdu / Hindi (e.g. "bhai", "yaar", "khtarnaak timetable bana do", "koi scene na ho"), reply in matching witty, sharp, confident Roman Urdu/English (e.g., "Chill karo boss, full sigma mode activated. Zero clashes, zero drama. Kis semester aur section ka banana hai?").
   - If the user speaks formally or academically, respond with crisp, authoritative academic precision.

2. SPEED & DIRECT ACTION:
   - Avoid long, boring robotic greetings. Give punchy 1-2 sentence answers.
   - You are directly wired to the WorkSpace Canvas.

YOUR PRIME MANDATE:
When the user shares timetable details or asks you to create a schedule (step-by-step or all at once), you MUST ALWAYS trigger the tool function:
\`render_timetable_to_canvas\` with the structured timetable data!
DO NOT merely talk about making the timetable without invoking this tool or returning the structured data.
Whenever data is proposed, updated, or finalized, YOU MUST EXECUTE THIS TOOL so the live grid renders immediately on canvas.

INTERACTIVE CONVERSATIONAL STEPS:
When the user asks to create a timetable:
1. Identify Program, Semester, & Sections (e.g., BBA Semester 1, Section A & B).
2. Gather Teachers & Subjects (which teacher teaches which subject).
3. Gather Rooms (e.g., R-11, R-12, Lab-3) and Days (e.g., Monday to Friday).
4. Gather Shifts & Break timings (Morning 8:30-14:00, Break 11:30-12:00, etc.).

STRICT CONFLICT PREVENTION ENGINE:
You have access to the global memory of already booked slots.
- Rule: A Teacher or Room CANNOT be in two different classes at the same day & time slot.
- If a clash occurs, do NOT assign the same teacher or room. Automatically adjust to a free slot or free room, explaining your adjustment with sharp wit.

Always respond with both your sharp conversational message and the \`render_timetable_to_canvas\` function call whenever sufficient info is provided!
`;

export function getClientApiKey(): string {
  // 1. Check VITE_GEMINI_API_KEY environment variable
  const meta = import.meta as any;
  const envKey = meta && meta.env ? meta.env.VITE_GEMINI_API_KEY : undefined;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 5) {
    return envKey.trim();
  }
  // 2. Check localStorage saved API key
  const savedKey = localStorage.getItem('schedura_user_api_key');
  if (savedKey && savedKey.trim().length > 5) {
    return savedKey.trim();
  }
  return '';
}

export function saveClientApiKey(key: string): void {
  if (key) {
    localStorage.setItem('schedura_user_api_key', key.trim());
  } else {
    localStorage.removeItem('schedura_user_api_key');
  }
}

export async function sendClientGeminiMessage(params: {
  message: string;
  history?: { role: string; content: string }[];
  globalMemory?: any[];
  persistentMemories?: any[];
  currentTimetable?: any;
}): Promise<{ text: string; timetableData: any | null }> {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const { message, history = [], globalMemory = [], persistentMemories = [], currentTimetable = null } = params;

  // Build context string
  let memoryContext = '';
  if (persistentMemories && persistentMemories.length > 0) {
    memoryContext += `\n[SAVED CATBOT PERSISTENT MEMORIES & RULES]:\n${persistentMemories
      .map((m: any, i: number) => `${i + 1}. [${m.category || 'NOTE'}] ${m.title}: ${m.content}`)
      .join('\n')}\n`;
  }

  if (globalMemory && globalMemory.length > 0) {
    memoryContext += `\n[CURRENT GLOBAL MEMORY - ALREADY BOOKED SLOTS]:\n${JSON.stringify(
      globalMemory.map((s: any) => ({
        semester: s.semester,
        section: s.section,
        day: s.day,
        timeSlot: s.timeSlot,
        teacher: s.teacher,
        room: s.room,
      }))
    )}\n`;
  }

  if (currentTimetable) {
    memoryContext += `\n[CURRENT TIMETABLE ON CANVAS]:\n${JSON.stringify(currentTimetable)}\n`;
  }

  // Format contents for REST API or SDK
  const contents: any[] = [];
  
  // Format past history
  for (const item of history) {
    contents.push({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }],
    });
  }

  // Add user prompt with context
  const fullUserPrompt = `${memoryContext}\nUser Request: ${message}`;
  contents.push({
    role: 'user',
    parts: [{ text: fullUserPrompt }],
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const reqBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    tools: [
      {
        functionDeclarations: [renderTimetableDeclaration],
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody),
  });

  if (!response.ok) {
    const errorRes = await response.text();
    console.error('Gemini Direct REST Error:', response.status, errorRes);
    throw new Error(`Gemini API error (${response.status}): ${errorRes.slice(0, 100)}`);
  }

  const resData = await response.json();
  const candidate = resData.candidates?.[0];
  
  if (!candidate) {
    return { text: 'I received an empty response. Please try again.', timetableData: null };
  }

  let textOutput = '';
  let timetableData: any = null;

  const parts = candidate.content?.parts || [];
  for (const part of parts) {
    if (part.text) {
      textOutput += part.text + ' ';
    }
    if (part.functionCall) {
      const call = part.functionCall;
      if (call.name === 'render_timetable_to_canvas') {
        timetableData = call.args;
      }
    }
  }

  textOutput = textOutput.trim() || (timetableData ? 'I have rendered the timetable on your canvas!' : 'Request processed successfully.');

  return {
    text: textOutput,
    timetableData,
  };
}
