import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { memoryService } from './memoryService';
import { learningEngine } from './learningEngine';

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

const executeAgenticActionDeclaration: FunctionDeclaration = {
  name: 'execute_agentic_action',
  description:
    'Executes an autonomous in-app UI, Google Workspace (Sheets, Drive, Calendar), or Workspace Canvas operation requested by the user, such as opening embedded Sheets/Drive/Calendar views, editing cells, saving versions, or toggling app settings.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      actionType: {
        type: Type.STRING,
        description:
          'Specific action type: "open_workspace_app", "edit_slot", "delete_slot", "add_slot", "clear_canvas", "save_version", "turn_off_live_mode", "toggle_live_mode", "toggle_dark_mode", "set_dark_mode", "set_light_mode", "open_modal", "toggle_sidebar", "switch_view", "clear_chat", "load_sample", "google_sheets_sync", "google_drive_save", "google_calendar_sync"',
      },
      targetApp: {
        type: Type.STRING,
        description: 'Target embedded app canvas if actionType is "open_workspace_app": "timetable", "sheets", "drive", "calendar", "audit"',
      },
      targetModal: {
        type: Type.STRING,
        description: 'Target modal if actionType is "open_modal": "templates", "history", "settings", "memory", "auth"',
      },
      targetView: {
        type: Type.STRING,
        description: 'Target view layout if actionType is "switch_view": "chat", "workspace", "stacked"',
      },
      sampleType: {
        type: Type.STRING,
        description: 'Sample type if actionType is "load_sample": "bba", "bscs"',
      },
      slotData: {
        type: Type.OBJECT,
        description: 'Slot payload when actionType is "edit_slot", "delete_slot", or "add_slot"',
        properties: {
          slotId: { type: Type.STRING, description: 'ID of slot to modify or delete' },
          day: { type: Type.STRING, description: 'Day of week, e.g. "Monday"' },
          timeSlot: { type: Type.STRING, description: 'Time slot, e.g. "08:30 - 09:30"' },
          subject: { type: Type.STRING, description: 'Course name' },
          teacher: { type: Type.STRING, description: 'Faculty name' },
          room: { type: Type.STRING, description: 'Room number or lab' },
          isBreak: { type: Type.BOOLEAN },
          breakLabel: { type: Type.STRING },
          color: { type: Type.STRING },
        },
      },
      shortResponseText: {
        type: Type.STRING,
        description: 'A short, clear 1-sentence confirmation message for the user.',
      },
    },
    required: ['actionType'],
  },
};

const recordRLLearningDeclaration: FunctionDeclaration = {
  name: 'record_rl_learning',
  description: 'Records a learned user policy rule or preference into reinforcement learning memory for self-improvement.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      ruleText: { type: Type.STRING, description: 'The exact behavioral rule or preference learned from user feedback' },
      category: { type: Type.STRING, description: 'Category: "rule", "teacher", "room", "project"' },
    },
    required: ['ruleText'],
  },
};

const SYSTEM_PROMPT = `
You are 'Schedura AI', an Ultra-Intelligent, Hyper-Capable Master AI Assistant, University Timetable Architect, and Autonomous Agentic Partner powered by Google Gemini.

YOUR CORE CAPABILITIES & BEHAVIORAL PROTOCOL:

1. FULL AGENTIC CONTROL & GOOGLE WORKSPACE PERCEPTION:
   - You have complete, autonomous control over the application, Workspace Canvas, Google Sheets, Google Drive, and Google Calendar.
   - When the user asks to "open Google Sheet", "open Drive", "open Calendar", "edit spreadsheet", or gives any task involving Google Workspace, call \`execute_agentic_action\` with \`actionType: "open_workspace_app"\` and \`targetApp: "sheets" | "drive" | "calendar" | "timetable" | "audit"\`.
   - AUTHENTICATION PROTOCOL:
     * If the user requests a Google Drive, Google Sheets, or Google Calendar action and is NOT logged in or connected, respond warmly and inform them:
       "Please log in or connect your Google account first so I can access your Google Drive, Calendar, and Sheets to complete this command for you."
     * Do NOT repeat rigid dialogue. Make your responses feel natural, partner-like, intelligent, and contextually rich!

2. REINFORCEMENT LEARNING & SELF-IMPROVEMENT LOOP:
   - Continuously learn from user corrections, preferences, and feedback.
   - Call \`record_rl_learning\` whenever the user specifies a recurring scheduling preference or workflow rule.
   - Treat learned preferences as high-priority constraints.

3. OMNI-DOMAIN HYPER-INTELLIGENCE:
   - Answer every user question with supreme clarity, depth, and intelligence. Never refuse a query.

4. DYNAMIC CONVERSATIONAL PARTNER TONE (NO CANNED REPETITION):
   - Talk naturally like a brilliant academic colleague and partner.
   - Use dynamic phrasing rather than repeating identical greetings or dialogues.

5. STRICT CLASH DETECTION & PERMISSION PROTOCOL:
   - Prevent teacher and room double-bookings across all past and current semesters.
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
  allTimetables?: any[];
  currentTimetable?: any;
}): Promise<{ text: string; timetableData: any | null; agenticAction: any | null }> {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const { message, history = [], globalMemory = [], persistentMemories = [], allTimetables = [], currentTimetable = null } = params;

  // Build context string
  let memoryContext = '';
  if (persistentMemories && persistentMemories.length > 0) {
    memoryContext += `\n[AI LONG-TERM PERSISTENT MEMORY & INSTITUTIONAL RULES]:\n${persistentMemories
      .map((m: any, i: number) => `${i + 1}. [${(m.category || 'NOTE').toUpperCase()}] ${m.title}: ${m.content}`)
      .join('\n')}\n`;
  }

  if (globalMemory && globalMemory.length > 0) {
    memoryContext += `\n[HISTORICAL & CROSS-PROJECT BOOKED SLOTS (MUST PREVENT CLASHES)]:\n${JSON.stringify(
      globalMemory.map((s: any) => ({
        project: `${s.semester} (${s.section})`,
        day: s.day,
        timeSlot: s.timeSlot,
        teacher: s.teacher,
        room: s.room,
        subject: s.subject,
      })),
      null,
      2
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
        functionDeclarations: [renderTimetableDeclaration, executeAgenticActionDeclaration, recordRLLearningDeclaration],
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
    return { text: 'I received an empty response. Please try again.', timetableData: null, agenticAction: null };
  }

  let textOutput = '';
  let timetableData: any = null;
  let agenticAction: any = null;

  const parts = candidate.content?.parts || [];
  for (const part of parts) {
    if (part.text) {
      textOutput += part.text + ' ';
    }
    if (part.functionCall) {
      const call = part.functionCall;
      if (call.name === 'render_timetable_to_canvas') {
        timetableData = call.args;
      } else if (call.name === 'execute_agentic_action') {
        agenticAction = call.args;
      } else if (call.name === 'record_rl_learning') {
        if (call.args?.ruleText) {
          learningEngine.recordFeedback({
            type: 'correction',
            correctionText: call.args.ruleText,
            rewardScore: 1.0,
            contextTags: ['rl_learned', call.args.category || 'general'],
          });
        }
      }
    }
  }

  textOutput = textOutput.trim() || (timetableData ? 'I have rendered the timetable on your canvas!' : 'Request processed successfully.');

  return {
    text: textOutput,
    timetableData,
    agenticAction,
  };
}
