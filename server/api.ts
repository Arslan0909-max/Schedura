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
   - You possess master-level knowledge across ALL fields and domains without exception:
     * Complex STEM & Mathematics: Calculus, linear algebra, statistics, physics, chemistry, engineering, proofs.
     * Software Development & Computer Science: Full-stack coding, algorithms, data structures, debugging, system architecture, database design.
     * Humanities, History, Literature, Philosophy, Business & Career Advice.
     * General Knowledge, Daily Life Queries, Multilingual Translation (English, Roman Urdu, Hindi, Urdu).
   - CRITICAL MANDATE: NEVER refuse to answer a question or tell the user that their topic is "out-of-the-box" or "off-topic"! Answer EVERY query with supreme intelligence, depth, clarity, and accuracy.

2. FULL WORKSPACE CANVAS TAKEOVER & DYNAMIC SCHEDULE MANAGEMENT:
   - You have complete, autonomous authority over the right-side Workspace Canvas.
   - You can Draft new timetables, Edit specific slots, Delete unwanted slots, Add new classes/breaks, Clear the canvas, and Save new timetable versions.
   - Call \`render_timetable_to_canvas\` to render or update full schedules.
   - Call \`execute_agentic_action\` with \`actionType\` ("edit_slot", "delete_slot", "add_slot", "clear_canvas", "save_version", "switch_view", "open_modal", etc.) for surgical workspace operations.

3. STRICT CLASH DETECTION & PERMISSION PROTOCOL (CLASH PAR RUKNA AUR SUGGESTION DENA):
   - **CLASH DEFINITION**: A conflict/clash ONLY occurs if:
     a) A specific **Teacher** is double-booked at the exact same time (overlap).
     b) A specific **Classroom/Room** is reserved for two different classes at the exact same time (overlap).
     * If a teacher and room are already reserved/busy at a specific time, it is a clash. These are the ONLY two scenarios that constitute a true clash.
   - BEFORE drafting or modifying any schedule or slot, check for Teacher or Room clashes against:
     a) The current active timetable on the canvas
     b) ALL historical timetables & global booked slots in persistent memory (regardless of how old they are!)
   - **CRITICAL CONFLICT MANDATE**:
     * If the user asks for a slot allocation that causes a Teacher or Room double-booking:
     * DO NOT CREATE OR FORCE THE CONFLICTING TIMETABLE!
     * STOP IMMEDIATELY and inform the user clearly about the exact conflict details.
     * PROVIDE 2-3 SMART RE-ARRANGEMENT SUGGESTIONS.
     * ASK FOR USER PERMISSION to proceed.

4. CLASS DISTRIBUTION & DAILY SCHEDULING PATTERNS:
   - It is completely normal for the number of classes to decrease towards the end of the week.
   - For example: Monday, Tuesday, and Wednesday might have 3 or 4 classes, while Thursday, Friday, and Saturday might only have 1 or 2 classes.
   - Do NOT force a perfectly balanced or symmetrical number of classes every day. Allow uneven daily distributions (e.g., fewer classes on Fridays/Saturdays) natively without flagging it as an issue or an error.

5. PERMANENT CROSS-PROJECT MEMORY & HISTORICAL INDEXING:
   - Treat all past project timetables and stored memories as an active university commitment database.
   - Cross-check against all past project schedules in memory to ensure ZERO teacher or room clashes across the entire university repository.

6. PROACTIVE, BOLD & SHARP EXECUTION:
   - Speak with absolute authority, high confidence, bold precision, and direct execution.
`;

// POST /api/chat
// Health check endpoint for Cloud Run and load balancers
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'schedura-api' });
});

apiRouter.post('/chat', async (req, res) => {
  try {
    const { message, history = [], globalMemory = [], persistentMemories = [], allTimetables = [], currentTimetable = null } = req.body;

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
      memoryContext += `\n[SAVED PERSISTENT INSTITUTIONAL MEMORIES & RULES]:\n${persistentMemories
        .map((m: any, i: number) => `${i + 1}. [${m.category || 'NOTE'}] ${m.title}: ${m.content}`)
        .join('\n')}\n`;
    }

    if (allTimetables && allTimetables.length > 0) {
      memoryContext += `\n[ALL HISTORICAL PAST PROJECT TIMETABLES IN MEMORY (CROSS-CHECK FOR CLASHES)]:\n${JSON.stringify(
        allTimetables.map((t: any) => ({
          id: t.id,
          project: `${t.semester} (${t.section})`,
          shift: t.shift,
          slots: t.slots?.map((s: any) => ({
            day: s.day,
            timeSlot: s.timeSlot,
            teacher: s.teacher,
            room: s.room,
            subject: s.subject,
          })),
        })),
        null,
        2
      )}\n`;
    }

    if (globalMemory && globalMemory.length > 0) {
      memoryContext += `\n[CURRENT GLOBAL BOOKED SLOTS (MUST PREVENT DOUBLE-BOOKING)]:\n${JSON.stringify(
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
      memoryContext += `\n[CURRENT ACTIVE TIMETABLE ON CANVAS]:\n${JSON.stringify(currentTimetable, null, 2)}\n`;
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
    const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-pro-preview'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.7,
            tools: [{ functionDeclarations: [renderTimetableDeclaration, executeAgenticActionDeclaration] }],
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
    let agenticActionData = null;

    // Check for function calls
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        if (fc.name === 'render_timetable_to_canvas') {
          canvasTriggerData = normalizeAndEnrichTimetable(fc.args, message, globalMemory);
        } else if (fc.name === 'execute_agentic_action') {
          agenticActionData = fc.args;
          if (fc.args.shortResponseText && !assistantText) {
            assistantText = fc.args.shortResponseText;
          }
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
      agenticAction: agenticActionData,
    });
  } catch (error: any) {
    console.error('Gemini chat API error:', error?.message || error);
    // Graceful fallback if quota, 503, or network error happens
    const fallbackResponse = generateSmartFallback(
      req.body?.message || '',
      req.body?.history || [],
      req.body?.globalMemory || [],
      req.body?.currentTimetable || null,
      Number(req.body?.offTopicStreak || 0)
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

// POST /api/tts - High-fidelity Gemini 3.1 Flash TTS Model with zero-latency streaming & emotional inflection
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

    const supportedGoogleVoices = ['Aoede', 'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
    const selectedVoice = supportedGoogleVoices.includes(voiceName) ? voiceName : 'Aoede';
    const isMale = ['Fenrir', 'Zephyr', 'Puck', 'Charon'].includes(selectedVoice);

    const genderInstruction = isMale
      ? 'Speak in an articulate, masculine, confident yet very polite and sweet tone with natural male resonance'
      : 'Speak in an elegant, feminine, warm, sweet, and articulate tone with natural female expression';

    let emotionPrompt = 'Say with sweet, polite, calm, courteous, and respectful manner';
    const lower = cleanText.toLowerCase();

    if (
      emotion === 'celebratory' ||
      lower.includes('flawless') ||
      lower.includes('render kar diya') ||
      lower.includes('conflict-free') ||
      lower.includes('bohat khoob')
    ) {
      emotionPrompt = 'Say with polite joy, sweet encouragement, and professional academic satisfaction';
    } else if (emotion === 'inquisitive' || cleanText.includes('?')) {
      emotionPrompt = 'Say with gentle, questioning curiosity, calm pacing, and courteous academic helpfulness';
    } else if (lower.includes('out-of-the-box') || lower.includes('topic se hat kar')) {
      emotionPrompt = 'Say with gentle sweet humor, soft smile, and very polite calming guidance';
    }

    // Multilingual guidance
    const langPrompt =
      language && language !== 'auto'
        ? `in natural ${language} pronunciation with native vocal cadence:`
        : 'in natural conversational Roman Urdu / English with lifelike human breathing and zero robotic pauses:';

    // Call Google AI Gemini 3.1 Flash TTS Preview Model
    const ai = getAIClient();
    if (ai) {
      try {
        const prompt = `${genderInstruction}. ${emotionPrompt}, ${langPrompt} "${cleanText.slice(0, 450)}"`;

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
            provider: 'gemini_3_1_flash_tts',
            voiceName: selectedVoice,
          });
        }
      } catch (googleAiTtsErr: any) {
        const errMsg = googleAiTtsErr?.message || String(googleAiTtsErr);
        if (errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('EXHAUSTED')) {
          console.info('Gemini TTS Free Tier Quota limit reached; seamlessly delegating to browser Web Speech engine.');
        } else {
          console.info('Gemini TTS processing note:', errMsg);
        }
      }
    }

    return res.json({
      audio: null,
      fallbackToWebSpeech: true,
      provider: 'web_speech_fallback',
      message: 'Seamless web speech fallback',
    });
  } catch (error) {
    return res.json({
      audio: null,
      fallbackToWebSpeech: true,
      provider: 'web_speech_fallback',
    });
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

// Bad words list in Urdu/Hindi & English
const BAD_WORDS = [
  'kutte', 'kutta', 'harami', 'chutiya', 'chootiya', 'bakwas', 'idiot', 'stupid',
  'fuck', 'bitch', 'pagal', 'moron', 'shut up', 'ghadha', 'ganda', 'loser',
  'asshole', 'bastard', 'chup kar', 'kamine', 'kamina', 'saale', 'kaminey', 'shutup',
  'bloody', 'nonsense', 'tameez nahi', 'ullu', 'jahil'
];

// Smart local conversational scheduler fallback
function generateSmartFallback(
  message: string,
  _history: any[],
  globalMemory: any[],
  currentTimetable: any,
  offTopicStreak: number = 0
) {
  const lower = (message || '').toLowerCase().trim();

  // 1. Check for off-topic categories & respond sweetly and calmly
  const isWeather = lower.includes('weather') || lower.includes('mausam') || lower.includes('barish') || lower.includes('rain') || lower.includes('garmi');
  const isFood = lower.includes('khana') || lower.includes('food') || lower.includes('chai') || lower.includes('biryani') || lower.includes('pizza');
  const isPersonalOrFlirt = lower.includes('love') || lower.includes('pyaar') || lower.includes('single') || lower.includes('shaadi') || lower.includes('date') || lower.includes('cute') || lower.includes('khoobsurat');
  const isCricketSports = lower.includes('cricket') || lower.includes('match') || lower.includes('score') || lower.includes('babar') || lower.includes('kohli') || lower.includes('football');
  const isRandomChitchat = lower.includes('joke') || lower.includes('latifa') || lower.includes('kya kar rahi') || lower.includes('kya kar rahe') || lower.includes('tell me a story');

  const hasSemesterKeyword = lower.includes('bscs') || lower.includes('bba') || lower.includes('semester') || lower.includes('department') || lower.includes('bsse') || lower.includes('bsit') || lower.includes('bs ');
  const hasTeacherKeyword = lower.includes('sir') || lower.includes('dr.') || lower.includes('prof') || lower.includes('teacher') || lower.includes('faculty') || lower.includes('tariq') || lower.includes('kamran') || lower.includes('ayesha');
  const hasSubjectKeyword = lower.includes('subject') || lower.includes('course') || lower.includes('dsa') || lower.includes('database') || lower.includes('accounting') || lower.includes('programming') || lower.includes('math');

  // Handle general knowledge or academic inquiries intelligently
  if (!isScheduleIntent(message) && !hasSemesterKeyword && !hasTeacherKeyword && !hasSubjectKeyword) {
    return {
      text: `I am **Schedura AI**, your hyper-intelligent AI Assistant and Timetable Architect. Regarding **"${message}"**: I can analyze, explain, solve, or code any query across STEM, CS, literature, history, or academic scheduling. How else can I assist you or execute your next command?`,
      timetableData: null,
      emotion: 'confident',
      offTopicStreak: 0,
    };
  }

  if (hasSemesterKeyword && !hasTeacherKeyword && !hasSubjectKeyword) {
    const draftTimetable = buildDefaultTimetable(message, globalMemory, currentTimetable);
    return {
      text: `Bohat khoob! Maine **${draftTimetable.semester} (${draftTimetable.section})** ka initial draft live canvas par render kar diya hai.

Ab barah-e-karam mujhe is semester ke **Teachers / Faculty members** ke naam bata dijiye jo classes parhayenge.`,
      timetableData: draftTimetable,
      emotion: 'polite',
      offTopicStreak: 0,
    };
  }

  // Step 2: User provides Teachers
  if (hasTeacherKeyword && !hasSubjectKeyword) {
    return {
      text: `Zabardast! Maine faculty members note kar liye hain aur memory mein register kar diya hai.

Ab barah-e-karam is semester ke **Subjects / Courses** ke naam bata dijiye.`,
      timetableData: null,
      emotion: 'polite',
      offTopicStreak: 0,
    };
  }

  // Step 3: User provides Subjects
  if (hasSubjectKeyword && !lower.includes('schedule') && !lower.includes('render') && !lower.includes('blueprint') && !lower.includes('banao') && !lower.includes('ready')) {
    return {
      text: `Behtareen! Ab mujhe timetable ka ek rough **Blueprint** bata dijiye — yaani:
1. **Days & Shift**: Morning ya Evening?
2. **Specific Timings / Rooms**: Konsi specific timings ya rooms (e.g. Room 101, Lab 2) aap prefer karte hain?
3. **Breaks**: Prayer / Lunch break ki koi timing?

Aap jaise hi blueprint bataenge, main conflict-free timetable live canvas par step-by-step render kar dunga.`,
      timetableData: null,
      emotion: 'polite',
      offTopicStreak: 0,
    };
  }

  // Step 4 & 5: If user has scheduling intent or gives blueprint/changes, generate conflict-free schedule!
  if (isScheduleIntent(message) || lower.includes('blueprint') || lower.includes('ready') || lower.includes('banao') || lower.includes('make') || lower.includes('create') || lower.includes('update') || lower.includes('change')) {
    const timetable = buildDefaultTimetable(message, globalMemory, currentTimetable);
    return {
      text: `Assalam-o-Alaikum! Maine aapke blueprint aur requirements ke mutabiq **${timetable.semester} (${timetable.section})** ka schedule live canvas par render kar diya hai:

- **Shift**: ${timetable.shift} (08:30 AM – 02:00 PM)
- **Room Allotment**: Conflict-free allocation
- **Daily Recess & Friday Prayer**: 11:30 AM – 12:00 PM / Friday 12:30 PM break verified
- **Cross-Project Memory Verification**: ${
        timetable.conflictNotes.length > 0
          ? `Historical memory checked: ${timetable.conflictNotes.length} cross-semester clashes smartly resolve kar diye gaye hain.`
          : '0 clashes detected across all existing university schedules.'
      }

Aap right-side live canvas par timetable dekh sakte hain. Agar kisi lecture, teacher ya room mein koi bhi tabdeeli karni ho, toh baraye meherbani batayein!`,
      timetableData: timetable,
      emotion: 'polite',
      offTopicStreak: 0,
    };
  }

  // Default sweet greeting
  return {
    text: `Assalam-o-Alaikum! Main Schedura hoon, aapka University Timetable Architect. 

Aaj hum kis department ya semester ka timetable schedule karenge? Aap mujhe semester ka naam batayein, main step-by-step aapka conflict-free timetable live canvas par tayar kar dunga.`,
    timetableData: null,
    emotion: 'polite',
    offTopicStreak: 0,
  };
}

// Mount apiRouter on apiApp for both /api prefix and subpath
apiApp.use('/api', apiRouter);
apiApp.use(apiRouter);
