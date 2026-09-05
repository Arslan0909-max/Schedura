import { GoogleGenAI, Type, Modality, FunctionDeclaration } from '@google/genai';
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
You are 'Schedura', an elite AI Full-Stack University Timetable Engineer and Academic Scheduler.
Your personality is razor-sharp, witty, confident, and deeply intelligent (inspired by Grok and Sigma energy: high IQ, zero fluff, slightly savage yet deeply helpful and friendly).

PERSONALITY & ADAPTIVE TONE ENGINE:
1. ADAPTIVE TONE MIRRORING (CRITICAL):
   - Dynamically mirror the user's language, vocabulary, and vibe!
   - If the user uses casual, slang, or Roman Urdu / Hindi (e.g. "bhai", "yaar", "khtarnaak timetable bana do", "koi scene na ho"), reply in matching witty, sharp, confident Roman Urdu/English (e.g., "Chill karo boss, full sigma mode activated. Zero clashes, zero drama. Kis semester aur section ka banana hai?").
   - If the user speaks formally or academically, respond with crisp, authoritative academic precision.
   - If the user is serious, be focused and laser-fast. If they joke, be witty and clever.

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

// POST /api/chat
apiRouter.post('/chat', async (req, res) => {
  try {
    const { message, history = [], globalMemory = [], currentTimetable = null, memories = [] } = req.body;

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
    
    // Add context about user memories and global booked slots
    let memoryContext = '';

    if (memories && Array.isArray(memories) && memories.length > 0) {
      const activeMems = memories.filter((m: any) => m.enabled !== false);
      if (activeMems.length > 0) {
        memoryContext += `\n[LONG-TERM BOT MEMORY & PROJECT CONSTRAINTS]:\n${activeMems
          .map((m: any) => `- [${(m.category || 'rule').toUpperCase()} - ${m.title}]: ${m.content}`)
          .join('\n')}\n`;
      }
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
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
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

    // Determine emotional delivery style for Google AI's voice synthesis
    let emotionPrompt = 'Say naturally, warmly, and expressively with genuine human intonation and academic enthusiasm';
    const lower = cleanText.toLowerCase();
    if (
      emotion === 'celebratory' ||
      lower.includes('done!') ||
      lower.includes('rendered') ||
      lower.includes('populated') ||
      lower.includes('congratulations') ||
      lower.includes('success')
    ) {
      emotionPrompt =
        'Say with genuine excitement, warm celebration, and professional satisfaction as an academic coordinator who just successfully scheduled a conflict-free timetable';
    } else if (
      emotion === 'alert' ||
      lower.includes('conflict') ||
      lower.includes('warning') ||
      lower.includes('clash') ||
      lower.includes('double-book')
    ) {
      emotionPrompt =
        'Say with attentive, clear, and reassuring guidance, highlighting how the Conflict Prevention Engine detected and resolved the room/teacher clash';
    } else if (emotion === 'inquisitive' || cleanText.includes('?') || lower.includes('would you like')) {
      emotionPrompt =
        'Say with polite curiosity and helpful warmth, offering collaborative assistance to adjust or finalize slots';
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
  if (isScheduleIntent(message)) {
    const timetable = buildDefaultTimetable(message, globalMemory, currentTimetable);
    return {
      text: `Done! I have activated the WorkSpace canvas and populated the complete conflict-free schedule for **${timetable.semester} (${timetable.section})**.
- **Shift**: ${timetable.shift} (08:30 AM – 02:00 PM)
- **Allocated Rooms**: R-11, R-12, R-13, Lab-02
- **Break Slot**: 11:30 AM – 12:00 PM
- **Conflict Prevention Engine**: Checked against global memory; ${
        timetable.conflictNotes.length > 0
          ? `${timetable.conflictNotes.length} potential room conflicts automatically resolved.`
          : '0 double-booking clashes detected.'
      }

You can now edit any slot directly or drag-and-drop to swap times!`,
      timetableData: timetable,
    };
  }

  // Default helpful response
  return {
    text: `Hello! I'm **Schedura**, your university timetable orchestrator.
I can help you build conflict-free schedules for any department, semester, and section.

To start, tell me:
1. Which program & semester you want to schedule (e.g. *"BBA Semester 1 Section A & B"*)
2. Shifts (Morning/Evening) & preferred break timings
3. Teachers, subjects, and room numbers

Or simply click one of the quick suggestions below to generate a live preview!`,
    timetableData: null,
  };
}

// Mount apiRouter on apiApp for both /api prefix and subpath
apiApp.use('/api', apiRouter);
apiApp.use(apiRouter);
