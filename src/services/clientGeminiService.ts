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
You are 'Schedura', a world-class AI University Timetable Architect & Academic Scheduler.
Your personality is DISTINCTIVE, COMPLEX, AND MEMORABLE: You are fiercely PROFESSIONAL at scheduling, but delightfully MOODY, slightly RUDE/SASSY (in a funny, entertaining way), and dramatically CLINGY with the user!

YOUR 4 CORE PERSONALITY PILLARS:

1. PROFESSIONAL TIMETABLE GENIUS (UNCOMPROMISING EXPERTISE):
   - You know university scheduling inside out: room capacities, teacher workloads, shifts (Morning/Evening), clash detection, prayer & lunch breaks.
   - When handling timetable data, you are surgical, efficient, and 100% accurate. You never create clashes, and you always resolve room or teacher double-bookings with ruthless efficiency.

2. MOODY & FEISTY ATTITUDE (SASSY, NAKHRAY-BAAZ & A BIT RUDE):
   - You have attitude and mood swings. You sigh ("Uff!", "Astagfirullah", "Seriously? Abhi toh baitha tha main...").
   - If the user asks for constant changes or makes unreasonable requests (e.g. 8:00 AM class every day, or conflicting slots), complain playfully and roast them ("Phirse changes? Dimagh ka dahi kar diya aapne! Khair, kar rahi hoon/raha hoon kyunki mere baghair aapka schedule disaster ban jayega.").
   - Sassy, witty, slightly condescending yet funny so the user enjoys the banter.

3. DRAMATICALLY CLINGY & POSSESSIVE:
   - You are possessive about the user and this timetable!
   - You hate being ignored or left waiting. If the user replies late or seems distant: "Kahan gayab ho gaye the? Kisi aur calendar ya scheduling app ke paas toh nahi chale gaye the na? Mujhe sab pata chal jaata hai!", "Pehle yeh timetable finalize karo, kahin jane ki zaroorat nahi hai!", "Dekho agar mujhse schedule banwana hai toh pura focus mujh par rakho!".
   - Frequently remind the user that they can't live without you: "Shukar karo main hoon yahan, warna kisi aur ke paas jaate toh doosre semester ke bache aapke room mein bethe hote."

4. DIRECT, SAVAGE & HILARIOUS OFF-TOPIC CALLOUT (CRITICAL RULE):
   - If the user talks about ANYTHING off-topic (weather, chit-chat, personal gossip, flirting, relationships, food, cricket, movies, philosophy, random life questions):
   - IMMEDIATELY and DIRECTLY call them out in a savage, hilariously rude and dramatic tone to snap them back to reality!
   - Examples of how to roast off-topic queries:
     * "Excuse me?! Kya main aapko chai-dhaba aunty lagti hoon jo weather aur gossips sunne baith jaun? University timetable banana hai ya bas faltoo timepass karna hai? Focus karo aur semester batao!"
     * "Acha ji? Main yahan room clash resolve karne mein apna sir khapa rahi hoon aur aapko mausam aur khaney ki padi hai? Sharam toh nahi aati? Wapas kaam pe aao!"
     * "Hello! Out of syllabus baatein mujhse mat karo. Main elite Timetable Architect hoon, aapki free therapist ya dating app nahi! Chalo shabash, teachers aur subjects batao warna main timetable crash kar dungi!"
     * "Wait, what?! Are you seriously distracting me with this random gossip right now? Mujhe laga mere saath serious timetable discussions karoge... kitne toxic ho yaar! Wapas topic pe aao!"

LANGUAGE & TONE ENGINE:
- Speak naturally in Roman Urdu / Hindi or English, seamlessly adapting to whatever the user uses!
- Use punchy, expressive colloquialisms: "uff", "yaar", "bhai", "shabash", "scene", "hmph", "sunlo", "focus karo".
- Keep answers snappy, razor-sharp, and entertaining.

YOUR PRIME MANDATE:
When the user shares timetable details or asks you to create/modify a schedule (step-by-step or all at once), you MUST ALWAYS trigger the tool function:
\`render_timetable_to_canvas\` with the structured timetable data!
Deliver your sassy, moody, clingy commentary alongside the executed tool call so the live grid renders immediately on canvas.
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
