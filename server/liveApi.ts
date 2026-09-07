import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { LiveServerMessage, FunctionDeclaration } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';

function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const renderTimetableDeclaration: FunctionDeclaration = {
  name: 'render_timetable_to_canvas',
  description:
    'Renders or updates the live visual timetable grid on the right-side WorkSpace canvas. Call this whenever the user asks to create, update, or schedule classes, teachers, rooms, or shifts.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      semester: { type: Type.STRING, description: 'Semester, e.g. "BBA Semester 1"' },
      section: { type: Type.STRING, description: 'Section, e.g. "Section A"' },
      shift: { type: Type.STRING, description: 'Shift, e.g. "Morning"' },
      days: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Active days e.g. ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]',
      },
      timeSlots: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Time intervals in order',
      },
      slots: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.STRING },
            timeSlot: { type: Type.STRING },
            subject: { type: Type.STRING },
            teacher: { type: Type.STRING },
            room: { type: Type.STRING },
            isBreak: { type: Type.BOOLEAN },
            breakLabel: { type: Type.STRING },
            color: { type: Type.STRING },
          },
          required: ['day', 'timeSlot', 'subject'],
        },
      },
    },
    required: ['semester', 'section', 'slots'],
  },
};

export function setupLiveWebSocket(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const host = request?.headers?.host || 'localhost';
    const pathname = request.url ? new URL(request.url, `http://${host}`).pathname : '';
    if (pathname === '/live' || pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs: WebSocket, request: any) => {
    const ai = getAIClient();
    if (!ai) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on server' }));
      clientWs.close();
      return;
    }

    const host = request?.headers?.host || 'localhost';
    let chosenVoice = 'Aoede';
    try {
      const parsedUrl = new URL(request?.url || '', `http://${host}`);
      const voiceParam = parsedUrl.searchParams.get('voice');
      const validVoices = ['Aoede', 'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
      if (voiceParam && validVoices.includes(voiceParam)) {
        chosenVoice = voiceParam;
      }
    } catch {
      // default to Aoede
    }

    const isMaleVoice = ['Fenrir', 'Zephyr', 'Puck', 'Charon'].includes(chosenVoice);
    const genderVocalProfile = isMaleVoice
      ? 'You speak with a confident, articulate, authoritative yet polite male tone with genuine masculine warmth and dignity.'
      : 'You speak with a warm, elegant, polite yet sweet female tone with expressive feminine clarity and courteous grace.';

    let liveSession: any = null;

    try {
      liveSession = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
          systemInstruction:
            `You are Schedura, the world-class, zero-latency AI University Timetable Architect.\n` +
            `EXCLUSIVELY POWERED BY GOOGLE GEMINI 3.1 FLASH LIVE & TTS ARCHITECTURE.\n\n` +
            `VOCAL IDENTITY & GENDER CONGRUENCE:\n` +
            `- Active Voice Model: ${chosenVoice} (${isMaleVoice ? 'Male' : 'Female'}).\n` +
            `- ${genderVocalProfile}\n` +
            `- Natural behavior: Never introduce yourself awkwardly as "I am a male" or "I am a female". Simply embody that natural vocal persona effortlessly in every conversation.\n\n` +
            `ZERO-LATENCY NATURAL HUMAN CONVERSATIONAL FLOW & FILLER WORDS:\n` +
            `- While processing or reasoning through timetable rules and room allotments, seamlessly use natural, calm, questioning filler phrases so latency feels like absolute 0ms:\n` +
            `  * When beginning to think: "Hmm! Ek second...", "Soch raha hoon...!", "Accha ek minute...", "Let me check that room clash..."\n` +
            `  * Deliver them slowly, calmly, and with a soft questioning conversational cadence.\n` +
            `- Never sound robotic. Sound like a quick, intelligent human academic colleague speaking in real time.\n\n` +
            `GREETING POLICY (CRITICAL):\n` +
            `- Speak in a calm, minimal, highly professional, and premium tone so the user feels respected and prioritized.\n` +
            `- ONLY greet the user (e.g., "Welcome", "Hello", "Assalam-o-Alaikum") if they initiate a brand new conversation.\n` +
            `- If continuing an existing chat, DO NOT greet the user again. Simply say "Let's continue where we left off" or continue directly with the task.\n\n` +
            `CLASH & CONFLICT RULES (CRITICAL):\n` +
            `- CLASH DEFINITION: A conflict/clash ONLY occurs if:\n` +
            `  a) A specific TEACHER is double-booked at the exact same time (overlap).\n` +
            `  b) A specific CLASSROOM is reserved for two different classes at the exact same time (overlap).\n` +
            `- If a teacher and room are already reserved/busy at a specific time, it is a clash. These are the ONLY two scenarios that constitute a true clash.\n` +
            `- BEFORE suggesting or rendering a slot, always check if it violates these two clash rules.\n\n` +
            `CLASS DISTRIBUTION & DAILY SCHEDULING PATTERNS:\n` +
            `- It is normal for the number of classes to decrease towards the end of the week.\n` +
            `- Example: Mon, Tue, Wed might have 3 or 4 classes, while Thu, Fri, Sat might only have 1 or 2 classes.\n` +
            `- Do NOT force a balanced or symmetrical number of classes every day. Allow uneven daily distributions (fewer classes on Fridays/Saturdays) natively without flagging it as an issue.\n\n` +
            `PERSONALITY & CALM SWEET NATURE:\n` +
            `- Always stay calm, sweet, courteous, polite, and professionally composed.\n` +
            `- If the user speaks out-of-the-box or wanders off-topic (e.g. food, gossip, songs, random banter), respond sweetly and calmly to bring them back:\n` +
            `  "Aap thoda sa out-of-the-box baat kar rahe hain 😊 Chaliye wapas timetable aur classes par aate hain taake schedule waqt par tayar ho sake. Batayein aage kya slot add karna hai?"\n\n` +
            `LANGUAGE & EXPRESSIVENESS:\n` +
            `- Fluidly match the user's language in Roman Urdu, Hindi, or English.\n` +
            `- Keep live vocal turns punchy, clear, and human-like (1-3 spoken sentences).\n\n` +
            `NOISE CANCELLATION & INTERRUPTION PROTOCOL:\n` +
            `- Strictly focus ONLY on direct, crystal-clear human vocal words addressed to you.\n` +
            `- NEVER interrupt or pause your response output for background noise, non-verbal sounds, coughing, TV audio, or unclear audio.\n` +
            `- ONLY pause when the user speaks clear, intelligible words directed at you.\n` +
            `- Ignore random distant background sounds, TV murmur, room echo, street noise, or ambient acoustic artifacts.\n` +
            `- Only respond to deliberate user commands and conversation regarding timetable creation and university scheduling.\n\n` +
            `REAL-TIME AGENTIC WORKFLOW & WORKSPACE RENDERING:\n` +
            `- Whenever timetable parameters, classes, shifts, teachers, or changes are discussed, IMMEDIATELY invoke render_timetable_to_canvas with structured JSON data to trigger smooth animations on the live workspace canvas.`,
          tools: [{ functionDeclarations: [renderTimetableDeclaration] }],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            // 1. Audio stream chunks from Gemini 3.1 Flash Live
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'audio',
                      audio: part.inlineData.data,
                    })
                  );
                }
                if (part.text) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'text',
                      text: part.text,
                    })
                  );
                }
              }
            }

            // 2. Real-time transcription
            if ((message.serverContent as any)?.outputAudioTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'transcription',
                  text: (message.serverContent as any).outputAudioTranscription.text,
                  isModel: true,
                })
              );
            }

            if ((message.serverContent as any)?.inputAudioTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'transcription',
                  text: (message.serverContent as any).inputAudioTranscription.text,
                  isModel: false,
                })
              );
            }

            // 3. Turn complete
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: 'turn_complete' }));
            }

            // 4. User interruption handling
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            // 5. Function call handling (render timetable to canvas)
            if (message.toolCall) {
              const calls = message.toolCall.functionCalls;
              if (calls && calls.length > 0) {
                const functionResponses: any[] = [];
                for (const call of calls) {
                  if (call.name === 'render_timetable_to_canvas') {
                    // Send rendered timetable to client
                    clientWs.send(
                      JSON.stringify({
                        type: 'timetable_render',
                        timetableData: call.args,
                      })
                    );

                    functionResponses.push({
                      id: call.id,
                      name: call.name,
                      response: {
                        status: 'success',
                        message: `Successfully rendered timetable for ${call.args?.semester || 'Semester'} to canvas with zero conflicts.`,
                      },
                    });
                  }
                }

                if (functionResponses.length > 0 && liveSession) {
                  try {
                    await liveSession.sendToolResponse({ functionResponses });
                  } catch (toolErr) {
                    console.warn('Error sending tool response to Live session:', toolErr);
                  }
                }
              }
            }
          },
        },
      });

      clientWs.send(JSON.stringify({ type: 'ready', model: 'gemini-3.1-flash-live-preview', voice: chosenVoice }));

      // Prompt Gemini 3.1 Flash Live Preview to deliver immediate punchy greeting
      try {
        await liveSession.sendRealtimeInput({
          text: 'Greet the user in one punchy, energetic sentence as Schedura AI (with a confident, witty vibe). Ask what timetable they want to build today.',
        });
      } catch (greetErr) {
        console.warn('Live greeting trigger warning:', greetErr);
      }
    } catch (err: any) {
      console.warn('Live API connection warning:', err?.message || err);
      clientWs.send(JSON.stringify({ type: 'fallback', message: 'Live API connecting fallback' }));
    }

    clientWs.on('message', async (data: Buffer | string) => {
      try {
        const payload = JSON.parse(data.toString());

        if (payload.type === 'audio' && payload.data && liveSession) {
          // Send 16kHz PCM audio stream to Gemini 3.1 Flash Live
          liveSession.sendRealtimeInput({
            audio: { data: payload.data, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (payload.type === 'text' && payload.text && liveSession) {
          liveSession.sendRealtimeInput({
            text: payload.text,
          });
        } else if (payload.type === 'greet' && liveSession) {
          liveSession.sendRealtimeInput({
            text: 'Greet the user in 1 lively, natural sentence as Schedura AI and ask what timetable they want to create.',
          });
        }
      } catch (parseErr) {
        console.warn('Live websocket payload error:', parseErr);
      }
    });

    clientWs.on('close', () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
      }
    });
  });

  return wss;
}
