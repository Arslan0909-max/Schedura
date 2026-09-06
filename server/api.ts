import express from 'express';
import { GoogleGenAI } from '@google/genai';

const apiRouter = express.Router();

function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
}

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'schedura-api', geminiConfigured: Boolean(process.env.GEMINI_API_KEY) });
});

apiRouter.post(['/chat', '/api/chat'], async (req, res) => {
  try {
    const { message, history = [], globalMemory = [], persistentMemories = [], allTimetables = [], currentTimetable = null } = req.body;
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message string is required' });

    const ai = getAIClient();
    if (!ai) return res.json({ text: 'Gemini is not configured on the server yet. Add GEMINI_API_KEY in Vercel Environment Variables.', timetableData: null, agenticAction: null });

    const contents: any[] = [];
    for (const h of history.slice(-8)) {
      contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] });
    }
    contents.push({
      role: 'user',
      parts: [{ text: `${persistentMemories.length ? `Saved memories:\n${JSON.stringify(persistentMemories)}\n` : ''}${allTimetables.length ? `Historical timetables:\n${JSON.stringify(allTimetables)}\n` : ''}${globalMemory.length ? `Booked slots:\n${JSON.stringify(globalMemory)}\n` : ''}${currentTimetable ? `Current timetable:\n${JSON.stringify(currentTimetable)}\n` : ''}\nUser Request: ${message}` }],
    });

    let response: any = null;
    let lastError: any = null;
    // Prefer a current stable Flash model, then fall back if the project/account has a different model set.
    for (const modelName of ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']) {
      try {
        response = await ai.models.generateContent({ model: modelName, contents, config: { temperature: 0.7 } });
        if (response) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Chat model ${modelName} failed:`, err?.message || err);
      }
    }
    if (!response) throw lastError || new Error('No Gemini model was available');

    return res.json({ text: response.text || 'Request processed successfully.', timetableData: null, agenticAction: null });
  } catch (error: any) {
    console.error('Gemini chat API error:', error?.message || error);
    return res.status(502).json({ error: 'Gemini backend request failed', detail: error?.message || 'Unknown Gemini error' });
  }
});

apiRouter.post(['/tts', '/api/tts'], async (req, res) => {
  try {
    const { text, voiceName = 'Aoede' } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required for TTS' });
    const ai = getAIClient();
    if (!ai) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });

    const cleanText = String(text).replace(/[*_#`~]/g, '').replace(/\[.*?\]/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    const supportedVoices = ['Aoede', 'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
    const selectedVoice = supportedVoices.includes(voiceName) ? voiceName : 'Aoede';
    const response: any = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
      },
    });
    const audio = response?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!audio) return res.status(502).json({ error: 'Gemini TTS returned no audio.' });
    return res.json({ audio, format: 'pcm_24k' });
  } catch (error: any) {
    console.error('Gemini TTS API error:', error?.message || error);
    return res.status(502).json({ error: 'Gemini TTS request failed', detail: error?.message || 'Unknown TTS error' });
  }
});

export { apiRouter };
