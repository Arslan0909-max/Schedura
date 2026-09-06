import { memoryService } from './memoryService';

export function getClientApiKey(): string {
  // Server-side environment variable process.env.GEMINI_API_KEY is used by the backend server.
  // No client-side key is required or allowed in the browser.
  return '';
}

export function saveClientApiKey(key: string): void {
  // No-op for backwards compatibility. API keys are handled strictly server-side.
}

export async function sendClientGeminiMessage(params: {
  message: string;
  history?: { role: string; content: string }[];
  globalMemory?: any[];
  persistentMemories?: any[];
  allTimetables?: any[];
  currentTimetable?: any;
}): Promise<{ text: string; timetableData: any | null; agenticAction: any | null }> {
  const { message, history = [], globalMemory = [], persistentMemories = [], allTimetables = [], currentTimetable = null } = params;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
        globalMemory,
        persistentMemories: persistentMemories.length > 0 ? persistentMemories : memoryService.getAll(),
        allTimetables,
        currentTimetable,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        text: data.text || 'Request processed successfully.',
        timetableData: data.timetableData || null,
        agenticAction: data.agenticAction || null,
      };
    } else {
      const errText = await response.text();
      console.error('Backend /api/chat error:', response.status, errText);
      return {
        text: 'I encountered an issue processing your request with the AI backend. Please try again.',
        timetableData: null,
        agenticAction: null,
      };
    }
  } catch (err: any) {
    console.error('Network error calling /api/chat:', err);
    return {
      text: 'Unable to connect to Schedura backend service. Please check your internet connection.',
      timetableData: null,
      agenticAction: null,
    };
  }
}
