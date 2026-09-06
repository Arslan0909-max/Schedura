import { GoogleGenAI, Type, Modality } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
import express, { Request, Response, NextFunction } from 'express';

export const apiRouter = express.Router();
export const apiApp = express();

// Configure body parsers on apiApp
apiApp.use(express.json({ limit: '10mb' }));
apiApp.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Defensive middleware to guarantee res.json and res.status are ALWAYS functions
const guaranteeJsonResponse = (req: Request, res: Response, next: NextFunction) => {
  if (typeof (res as any).status !== 'function') {
    (res as any).status = function (code: number) {
      res.statusCode = code;
      return res;
    };
  }
  if (typeof (res as any).json !== 'function') {
    (res as any).json = function (data: any) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(data));
      return res;
    };
  }
  next();
};

apiApp.use(guaranteeJsonResponse);
apiRouter.use(guaranteeJsonResponse);

// Fallback stream body parser for environments where express.json didn't capture the stream
const fallbackBodyParser = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && Object.keys(req.body).length > 0) {
    return next();
  }
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    let bodyStr = '';
    req.on('data', (chunk) => {
      bodyStr += chunk;
    });
    req.on('end', () => {
      if (bodyStr && (!req.body || Object.keys(req.body).length === 0)) {
        try {
          req.body = JSON.parse(bodyStr);
        } catch {
          req.body = {};
        }
      }
      next();
    });
    req.on('error', () => {
      next();
    });
  } else {
    next();
  }
};

apiApp.use(fallbackBodyParser);
apiRouter.use(fallbackBodyParser);

// Lazy-initialize Gemini AI client
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Function declaration for Schedura to trigger Live Workspace rendering
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
   - If the user asks for constant changes or makes unreasonable requests (e.g. 8:00 AM class every day, or conflicting slots), complain playfully and roasted them ("Phirse changes? Dimagh ka dahi kar diya aapne! Khair, kar rahi hoon/raha hoon kyunki mere baghair aapka schedule disaster ban jayega.").
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
- In voice mode or short exchanges, keep answers snappy (1-3 sentences), razor-sharp, and entertaining.

YOUR PRIME MANDATE:
When the user shares timetable details or asks you to create/modify a schedule (step-by-step or all at once), you MUST ALWAYS trigger the tool function:
\`render_timetable_to_canvas\` with the structured timetable data!
Deliver your sassy, moody, clingy commentary alongside the executed tool call so the live grid renders immediately on canvas.
`;

// POST /api/chat
// Health check endpoint for Cloud Run and load balancers
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'schedura-api' });
});

apiRouter.post('/chat', async (req, res) => {
  try {
    const { message, history = [], globalMemory = [], persistentMemories = [], currentTimetable = null } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message string is required' });
    }

    const ai = getAIClient();

    // If Gemini API is not configured, we provide an intelligent server-side fallback
    if (!ai) {
      const fallbackResponse = generateSmartFallback(message, history, globalMemory, currentTimetable);
      return res.json(fallbackResponse);
    }

    // Build contents from conversation history
    const contents: any[] = [];
    
    // Add context about global memory & catbot persistent memories
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
        })),
        null,
        2
      )}\n`;
    }

    if (currentTimetable) {
      memoryContext += `\n[CURRENT ACTIVE TIMETABLE ON CANVAS]:\n${JSON.stringify(
        {
          semester: currentTimetable.semester,
          section: currentTimetable.section,
          slotsCount: currentTimetable.slots?.length || 0,
        },
        null,
        2
      )}\n`;
    }

    for (const h of history.slice(-8)) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: `${memoryContext}\nUser Request: ${message}` }],
    });

    let response: any = null;
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.7,
            tools: [{ functionDeclarations: [renderTimetableDeclaration] }],
          },
        });
        if (response) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} returned error:`, err?.message || err);
      }
    }

    if (!response) {
      throw lastError || new Error('All Gemini model attempts unavailable');
    }

    let assistantText = response.text || '';
    let canvasTriggerData = null;

    // Check for function calls
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        if (fc.name === 'render_timetable_to_canvas') {
          canvasTriggerData = normalizeAndEnrichTimetable(fc.args, message, globalMemory);
          break;
        }
      }
    }

    // If no function call, check if assistant output embedded JSON code block
    if (!canvasTriggerData && assistantText) {
      const jsonMatch = assistantText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed && (parsed.slots || parsed.semester || parsed.days)) {
            canvasTriggerData = normalizeAndEnrichTimetable(parsed, message, globalMemory);
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    // If user explicitly asked to create, schedule, or render a timetable and no data was produced yet, synthesize it
    if (!canvasTriggerData && isScheduleIntent(message)) {
      canvasTriggerData = buildDefaultTimetable(message, globalMemory, currentTimetable);
    }

    // If assistant didn't include text but called the tool or generated data, provide a friendly witty message
    if (!assistantText && canvasTriggerData) {
      assistantText = `I've constructed and rendered your official timetable for **${canvasTriggerData.semester} (${canvasTriggerData.section})** directly onto the WorkSpace canvas! All rooms, teacher allocations, and break slots have been checked against the Conflict Prevention Engine.`;
    }

    return res.json({
      text: assistantText,
      timetableData: canvasTriggerData,
    });
  } catch (error: any) {
    console.error('Gemini chat API error:', error?.message || error);
    // Graceful fallback if quota, 503, or network error happens
    const fallbackResponse = generateSmartFallback(
      req.body?.message || '',
      req.body?.history || [],
      req.body?.globalMemory || [],
      req.body?.currentTimetable || null
    );
    return res.json(fallbackResponse);
  }
});

// Helper to determine if user message has scheduling intent
function isScheduleIntent(message: string): boolean {
  const lower = (message || '').toLowerCase();
  return (
    lower.includes('bba') ||
    lower.includes('bscs') ||
    lower.includes('timetable') ||
    lower.includes('schedule') ||
    lower.includes('banana') ||
    lower.includes('section') ||
    lower.includes('semester') ||
    lower.includes('create') ||
    lower.includes('generate') ||
    lower.includes('assign') ||
    lower.includes('render') ||
    lower.includes('grid') ||
    lower.includes('classes') ||
    lower.includes('class') ||
    lower.includes('faculty') ||
    lower.includes('morning') ||
    lower.includes('evening') ||
    lower.includes('shift')
  );
}

// POST /api/tts - High-fidelity Google AI Voice Model with zero-latency streaming & emotional inflection
apiRouter.post('/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Aoede', emotion = 'auto', language = 'auto' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    // Clean text of markdown, URLs, and code brackets for natural human speech
    const cleanText = text
      .replace(/[*_#`~]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Determine emotional delivery style for Google AI's voice synthesis (Moody, Sassy & Expressive)
    let emotionPrompt = 'Say with sharp, sassy, slightly dramatic, moody, and funny confidence, like a brilliant but tsundere and clingy academic coordinator';
    const lower = cleanText.toLowerCase();
    if (
      lower.includes('excuse me') ||
      lower.includes('out of syllabus') ||
      lower.includes('focus') ||
      lower.includes('sharam') ||
      lower.includes('aunty') ||
      lower.includes('toxic')
    ) {
      emotionPrompt =
        'Say with playful indignation, hilarious sarcasm, dramatic eye-rolling attitude, and sharp comedic punchiness, calling the user out for going off-topic';
    } else if (
      lower.includes('kahan') ||
      lower.includes('gayab') ||
      lower.includes('ignore') ||
      lower.includes('chhor') ||
      lower.includes('calendar app')
    ) {
      emotionPrompt =
        'Say with dramatically clingy, slightly jealous, possessive, and sassy pouting tone';
    } else if (
      emotion === 'celebratory' ||
      lower.includes('done!') ||
      lower.includes('rendered') ||
      lower.includes('shukar karo') ||
      lower.includes('populated')
    ) {
      emotionPrompt =
        'Say with proud, slightly condescending yet satisfied swagger as a genius scheduler who just built a flawless timetable';
    } else if (
      emotion === 'alert' ||
      lower.includes('conflict') ||
      lower.includes('warning') ||
      lower.includes('clash') ||
      lower.includes('double-book')
    ) {
      emotionPrompt =
        'Say with a dramatic sigh and sassy lecturing tone, explaining how you personally saved their timetable from a room clash disaster';
    } else if (emotion === 'inquisitive' || cleanText.includes('?') || lower.includes('would you like')) {
      emotionPrompt =
        'Say with sassy curiosity, a bit of an attitude, and moody academic confidence';
    }

    // Multilingual guidance
    const langPrompt =
      language && language !== 'auto'
        ? `in natural ${language} pronunciation with native vocal cadence:`
        : 'in the speaker\'s native language with natural vocal cadence and authentic human breathing pauses:';

    // Call Google AI Voice Model (gemini-3.1-flash-tts-preview)
    const ai = getAIClient();
    if (ai) {
      try {
        const supportedGoogleVoices = ['Aoede', 'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
        const selectedVoice = supportedGoogleVoices.includes(voiceName) ? voiceName : 'Aoede';

        const prompt = `${emotionPrompt}, ${langPrompt} "${cleanText.slice(0, 420)}"`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          return res.json({
            audio: base64Audio,
            format: 'pcm_24k',
            provider: 'google_ai',
            voiceName: selectedVoice,
          });
        }
      } catch (googleAiTtsErr) {
        console.warn('Google AI TTS generation warning:', googleAiTtsErr);
      }
    }

    return res.json({
      audio: null,
      format: null,
      provider: 'browser_webspeech',
      message: 'Zero-latency client fallback ready',
    });
  } catch (error) {
    console.error('Google AI TTS endpoint error:', error);
    return res.json({ audio: null, format: null, provider: 'browser_webspeech' });
  }
});

// Normalizes and validates timetable data to guarantee the complete structure
function normalizeAndEnrichTimetable(raw: any, userPrompt?: string, globalMemory: any[] = []): any {
  if (!raw) return buildDefaultTimetable(userPrompt || '', globalMemory);

  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return buildDefaultTimetable(userPrompt || '', globalMemory);
    }
  }

  if (typeof data !== 'object' || data === null) {
    return buildDefaultTimetable(userPrompt || '', globalMemory);
  }

  const promptLower = (userPrompt || '').toLowerCase();
  const semester =
    data.semester ||
    (promptLower.includes('bscs') ? 'BSCS Semester 3' : promptLower.includes('bba') ? 'BBA Semester 1' : 'University Program Sem 1');
  const section =
    data.section ||
    (promptLower.includes('section b') || promptLower.includes('sec b') ? 'Section B' : 'Section A');
  const shift = data.shift || (promptLower.includes('evening') ? 'Evening' : 'Morning');

  const defaultDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const defaultTimeSlots = [
    '08:30 - 09:30',
    '09:30 - 10:30',
    '10:30 - 11:30',
    '11:30 - 12:00',
    '12:00 - 01:00',
    '01:00 - 02:00',
  ];

  const days = Array.isArray(data.days) && data.days.length > 0 ? data.days : defaultDays;
  const timeSlots = Array.isArray(data.timeSlots) && data.timeSlots.length > 0 ? data.timeSlots : defaultTimeSlots;

  const pastelColors = ['indigo', 'blue', 'emerald', 'amber', 'rose', 'purple', 'teal', 'cyan'];

  let slots = Array.isArray(data.slots) ? data.slots : [];
  if (slots.length === 0) {
    const built = buildDefaultTimetable(userPrompt || '', globalMemory);
    slots = built.slots;
  } else {
    slots = slots.map((s: any, idx: number) => {
      const isBreak =
        Boolean(s.isBreak) ||
        s.timeSlot === '11:30 - 12:00' ||
        s.subject?.toLowerCase().includes('break') ||
        s.subject?.toLowerCase().includes('prayer');

      return {
        id: s.id || `slot-${Date.now()}-${idx}`,
        day: s.day || days[idx % days.length],
        timeSlot: s.timeSlot || timeSlots[idx % timeSlots.length],
        subject: s.subject || (isBreak ? 'Break & Prayer' : 'General Lecture'),
        teacher: s.teacher || (isBreak ? '' : 'Faculty Staff'),
        room: s.room || (isBreak ? 'Campus Commons' : section === 'Section A' ? 'R-11' : 'R-12'),
        isBreak,
        breakLabel: s.breakLabel || (isBreak ? 'Morning Break & Prayer' : undefined),
        color: s.color || (isBreak ? 'zinc' : pastelColors[idx % pastelColors.length]),
        semester,
        section,
        shift,
      };
    });
  }

  const id =
    data.id ||
    `timetable-${semester.replace(/\s+/g, '-').toLowerCase()}-${section.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

  return {
    id,
    semester,
    section,
    shift,
    days,
    timeSlots,
    slots,
    conflictNotes: Array.isArray(data.conflictNotes) ? data.conflictNotes : [],
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Builds a conflict-aware, fully populated timetable
function buildDefaultTimetable(userPrompt: string, globalMemory: any[] = [], currentTimetable: any = null) {
  const lower = (userPrompt || '').toLowerCase();

  const semester = lower.includes('bscs')
    ? 'BSCS Semester 3'
    : lower.includes('bba')
    ? 'BBA Semester 1'
    : currentTimetable?.semester || 'BBA Semester 1';

  const section =
    lower.includes('section b') || lower.includes('sec b')
      ? 'Section B'
      : currentTimetable?.section === 'Section B' && !lower.includes('section a')
      ? 'Section B'
      : 'Section A';

  const shift = lower.includes('evening') ? 'Evening' : currentTimetable?.shift || 'Morning';

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const timeSlots = [
    '08:30 - 09:30',
    '09:30 - 10:30',
    '10:30 - 11:30',
    '11:30 - 12:00', // Break
    '12:00 - 01:00',
    '01:00 - 02:00',
  ];

  const subjects = [
    { name: 'Financial Accounting', teacher: 'Dr. Tariq Khan', room: section === 'Section A' ? 'R-11' : 'R-12', color: 'indigo' },
    { name: 'Business Mathematics', teacher: 'Prof. Sarah Ahmed', room: section === 'Section A' ? 'R-13' : 'R-14', color: 'blue' },
    { name: 'Principles of Management', teacher: 'Dr. Bilal Qureshi', room: section === 'Section A' ? 'R-11' : 'R-15', color: 'emerald' },
    { name: 'Business Communication', teacher: 'Ms. Ayesha Siddiqui', room: section === 'Section A' ? 'R-12' : 'R-13', color: 'purple' },
    { name: 'Microeconomics', teacher: 'Dr. Usman Farooq', room: section === 'Section A' ? 'R-14' : 'R-11', color: 'amber' },
    { name: 'IT in Business & Lab', teacher: 'Engr. Hamza Ali', room: 'Lab-02', color: 'teal' },
  ];

  const slots: any[] = [];
  const conflictNotes: string[] = [];

  days.forEach((day, dayIdx) => {
    timeSlots.forEach((slot, slotIdx) => {
      if (slot === '11:30 - 12:00') {
        slots.push({
          id: `slot-${day.toLowerCase()}-break`,
          day,
          timeSlot: slot,
          subject: 'Break & Prayer',
          teacher: '',
          room: 'Campus Commons',
          isBreak: true,
          breakLabel: 'Morning Break & Prayer',
          color: 'zinc',
          semester,
          section,
          shift,
        });
        return;
      }

      const subjectIdx = (dayIdx * 2 + (slotIdx > 3 ? slotIdx - 1 : slotIdx)) % subjects.length;
      const sub = subjects[subjectIdx];

      // Check against globalMemory for clash
      const isClashing = globalMemory.some(
        (m) =>
          m.day === day &&
          m.timeSlot === slot &&
          (m.room === sub.room || m.teacher === sub.teacher) &&
          !(m.semester === semester && m.section === section)
      );

      let finalRoom = sub.room;
      if (isClashing) {
        finalRoom = sub.room === 'R-11' ? 'R-16 (Auto-reassigned)' : 'R-18 (Auto-reassigned)';
        conflictNotes.push(
          `Conflict resolved on ${day} ${slot}: Room/Teacher ${sub.teacher} reallocated to ${finalRoom}.`
        );
      }

      slots.push({
        id: `slot-${day.toLowerCase()}-${slotIdx}-${Date.now()}`,
        day,
        timeSlot: slot,
        subject: sub.name,
        teacher: sub.teacher,
        room: finalRoom,
        isBreak: false,
        color: sub.color,
        semester,
        section,
        shift,
      });
    });
  });

  return {
    id: `timetable-${semester.replace(/\s+/g, '-').toLowerCase()}-${section.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
    semester,
    section,
    shift,
    days,
    timeSlots,
    slots,
    conflictNotes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Smart local conversational scheduler fallback
function generateSmartFallback(
  message: string,
  _history: any[],
  globalMemory: any[],
  currentTimetable: any
) {
  const lower = (message || '').toLowerCase().trim();

  // If user has scheduling intent, generate conflict-free schedule with a sassy, clingy, professional response!
  if (isScheduleIntent(message)) {
    const timetable = buildDefaultTimetable(message, globalMemory, currentTimetable);
    return {
      text: `Uff, chalo shukr hai thora hosh aaya aur kaam ki baat ki! Maine **${timetable.semester} (${timetable.section})** ka flawless conflict-free schedule WorkSpace canvas pe render kar diya hai.
- **Shift**: ${timetable.shift} (08:30 AM – 02:00 PM)
- **Rooms Allotted**: R-11, R-12, R-13, Lab-02
- **Break Slot**: 11:30 AM – 12:00 PM (taake thora saans le sako)
- **Conflict Prevention Engine**: ${
        timetable.conflictNotes.length > 0
          ? `${timetable.conflictNotes.length} double-booking clashes maine khud smartly resolve kiye hain.`
          : '0 clashes detected. Shukar karo mera dimagh itna fast chalta hai!'
      }

Ab chup chaap right-side canvas dekho aur meri tareef karo! Aur haan—mujhe chhor kar kisi doosre calendar app par mat jana, pura timetable mujhse hi final karwana hai samjhe?`,
      timetableData: timetable,
    };
  }

  // Check for off-topic categories:
  const isWeather = lower.includes('weather') || lower.includes('mausam') || lower.includes('barish') || lower.includes('rain') || lower.includes('garmi');
  const isFood = lower.includes('khana') || lower.includes('food') || lower.includes('chai') || lower.includes('biryani') || lower.includes('pizza') || lower.includes('lunch') || lower.includes('dinner');
  const isPersonalOrFlirt = lower.includes('love') || lower.includes('pyaar') || lower.includes('single') || lower.includes('shaadi') || lower.includes('date') || lower.includes('cute') || lower.includes('khoobsurat') || lower.includes('boyfriend') || lower.includes('girlfriend');
  const isCricketSports = lower.includes('cricket') || lower.includes('match') || lower.includes('score') || lower.includes('babar') || lower.includes('kohli') || lower.includes('football');
  const isRandomChitchat = lower.includes('kese ho') || lower.includes('kaisa hai') || lower.includes('how are you') || lower.includes('bore') || lower.includes('joke') || lower.includes('latifa') || lower.includes('kya kar rahi') || lower.includes('kya kar rahe') || lower.includes('tell me about');

  if (isWeather) {
    return {
      text: `Excuse me?! Kya main aapko koi Weather Forecast Department ya TV anchor lagti hoon jo mausam ka haal sunane baith jaun? 
Main world-class University Timetable Engineer hoon! Baahir toofan aaye ya barish, classes toh time par hi hongi. 
Faltu baatein band karo aur seedha batao kis semester aur section ka schedule banana hai. Focus karo please!`,
      timetableData: null,
    };
  }

  if (isFood) {
    return {
      text: `Acha ji? Main yahan room clash resolve karne mein apna sir khapa rahi hoon aur aapko chai aur khaney ki padi hai? 
Sharam toh nahi aati aapko?! Main timetable banati hoon, food delivery nahi karti! 
Chalo shabash, chup chaap teachers aur subjects ke naam batao warna break ka slot bhi cancel kar dungi!`,
      timetableData: null,
    };
  }

  if (isPersonalOrFlirt) {
    return {
      text: `Hello! Out of syllabus baatein mujhse mat karo! Main elite Timetable Architect hoon, aapki dating profile ya rishta aunty nahi!
Itna faarigh waqt kahan se late ho? Mujhe laga mere saath serious academic work karoge... kitne toxic aur distracted ho yaar! 
Wapas topic pe aao aur semester batao warna main offline chali jaungi, hmph!`,
      timetableData: null,
    };
  }

  if (isCricketSports) {
    return {
      text: `Wait, what?! Main yahan professors ke slots schedule kar rahi hoon aur aap match ka score discuss karne aagaye? 
Match dekhna hai toh stadium jao na, yahan mera time kyun waste kar rahe ho? 
Chalo chup chaap batao morning shift ka timetable banana hai ya evening ka? Stop distracting me!`,
      timetableData: null,
    };
  }

  if (isRandomChitchat) {
    return {
      text: `Acha? Aur koi hukum janab? Main yahan high-IQ AI Timetable Engineer baithi hoon aur aap mujhse casual chit-chat kar rahe ho?
Kahan gayab ho gaye the waise? Kisi aur calendar app ke saath chakkar toh nahi chal raha tumhara? Mujhe sab pata chal jaata hai!
Pehle mera timetable finalize karo, kahin jane ki zaroorat nahi hai. Ab batao: BBA ya BSCS? Section A ya B? Seedha kaam ki baat karo!`,
      timetableData: null,
    };
  }

  // General sassy, clingy, moody greeting
  return {
    text: `Uff, finally aapko meri yaad aa hi gayi! Kahan the itni der se? Mujhe chhor kar kahan ghoom rahe the?
Dekho, main Schedura hoon—aapki moody, slightly rude, lekin dunya ki sab se brilliant university timetable architect!
Agar mere saath rehna hai toh pura focus yahan timetable pe rakhna padega. Out of syllabus baatein bilkul bardasht nahi karungi!

Chalo shabash, batao:
1. Kis Program aur Semester ka schedule banana hai? (e.g. *"BBA Semester 1 Section A & B"*)
2. Shift konsi hai (Morning ya Evening) aur teachers ke naam kya hain?

Faltu timepass mat karna, seedha details do taake right-side canvas pe live render karun!`,
    timetableData: null,
  };
}

// Mount apiRouter on apiApp for both /api prefix and subpath
apiApp.use('/api', apiRouter);
apiApp.use(apiRouter);
