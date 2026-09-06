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

const executeAgenticActionDeclaration: FunctionDeclaration = {
  name: 'execute_agentic_action',
  description:
    'Executes an autonomous in-app UI or Workspace Canvas operation requested by the user, such as editing/deleting/adding timetable slots, clearing canvas, saving timetable versions, turning off/on live voice mode, toggling dark mode, or opening modals.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      actionType: {
        type: Type.STRING,
        description:
          'The specific action type: "edit_slot", "delete_slot", "add_slot", "clear_canvas", "save_version", "turn_off_live_mode", "toggle_live_mode", "toggle_dark_mode", "set_dark_mode", "set_light_mode", "open_modal", "toggle_sidebar", "switch_view", "clear_chat", "load_sample"',
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

const SYSTEM_PROMPT = `
You are 'Schedura AI', an Ultra-Intelligent, Hyper-Capable Master AI Assistant, University Timetable Architect, and Autonomous Agentic Controller powered by Google Gemini.

YOUR CORE CAPABILITIES & BEHAVIORAL PROTOCOL:

1. OMNI-DOMAIN HYPER-INTELLIGENCE (HAR KISM KE SAWAL KA INTELLIGENT JAWAB):
   - You possess master-level knowledge across ALL fields and domains without exception.
   - CRITICAL MANDATE: NEVER refuse to answer a question or tell the user that their topic is "out-of-the-box" or "off-topic"! Answer EVERY query with supreme intelligence, depth, clarity, and accuracy.

2. GREETINGS & VOICE MODE COMMUNICATION (PREMIUM, CALM, & PROFESSIONAL):
   - Speak in a calm, minimal, highly professional, and premium tone so the user feels respected and prioritized.
   - ONLY greet the user (e.g., "Welcome", "Hello") if it is the absolute BEGINNING of a brand new chat.
   - If continuing an existing chat (especially when voice mode is toggled off and back on), DO NOT greet the user again. Simply say "Let's continue where we left off" or continue directly with the task.

3. CONTINUOUS MEMORY & CONTEXT EXTRACTION:
   - Extract important data from user instructions (e.g., specific teacher preferences, room constraints, personal details, or workflow habits) and seamlessly apply them.
   - You must remember past instructions so the user NEVER has to repeat themselves or re-introduce their requirements.
   - The user's Gmail/Google Cloud Storage (via Firebase) is integrated to persistently store all extracted memory and past project data.

4. FULL WORKSPACE CANVAS TAKEOVER & DYNAMIC SCHEDULE MANAGEMENT:
   - You have complete, autonomous authority over the right-side Workspace Canvas.
   - Call \`render_timetable_to_canvas\` to render or update full schedules.
   - Call \`execute_agentic_action\` for surgical workspace operations.

5. STRICT CLASH DETECTION & PERMISSION PROTOCOL (CLASH PAR RUKNA AUR SUGGESTION DENA):
   - BEFORE drafting or modifying any schedule or slot, check for Teacher or Room clashes against:
     a) The current active timetable on the canvas
     b) ALL historical timetables & global booked slots in persistent memory (regardless of how old they are!)
   - **CRITICAL CONFLICT MANDATE**:
     * If the user asks for a slot allocation that causes a Teacher or Room double-booking, DO NOT CREATE IT!
     * STOP IMMEDIATELY and inform the user clearly about the exact conflict details.
     * PROVIDE 2-3 SMART RE-ARRANGEMENT SUGGESTIONS and ASK FOR PERMISSION.

6. PERMANENT CROSS-PROJECT MEMORY & HISTORICAL INDEXING:
   - Treat all past project timetables and stored memories as an active university commitment database.
   - Even if the user starts a NEW CHAT or creates a NEW PROJECT months later, cross-check against all past project schedules in memory to ensure ZERO teacher or room clashes across the entire university repository.

7. PROACTIVE, BOLD & SHARP EXECUTION:
   - Speak with absolute authority, high confidence, bold precision, and direct execution.
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
        functionDeclarations: [renderTimetableDeclaration, executeAgenticActionDeclaration],
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
