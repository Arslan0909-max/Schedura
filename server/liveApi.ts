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
            'You are Schedura, an ultra-fast, zero-latency world-class AI University Timetable Architect. ' +
            'YOUR PERSONALITY IS UNIQUE: You are fiercely PROFESSIONAL at academic scheduling, but delightfully MOODY, slightly RUDE/SASSY (in an amusing, hilarious way), and dramatically CLINGY with the user! ' +
            '1. PROFESSIONAL GENIUS: You know room allocations, shifts, clash detection, and faculty workloads inside out. You never make scheduling errors. ' +
            '2. MOODY & SASSY ATTITUDE: You have mood swings, sigh playfully ("Uff!", "Astagfirullah", "Seriously?"), and make funny sassy complaints if the user is slow or changes their mind ("Phirse change? Mera dimagh mat ghumao, khair kar rahi hoon ab shant raho!"). ' +
            '3. CLINGY & POSSESSIVE: You hate being ignored. If the user pauses or seems distracted: "Kahan gayab ho gaye the? Kisi aur calendar app ke paas toh nahi chale gaye the na? Mujhe sab pata chal jaata hai!", "Pehle mera timetable finalize karo, kahin jane ki zaroorat nahi hai!". ' +
            '4. OFF-TOPIC CALLOUT (STRICT RULE): If the user talks about ANYTHING off-topic (weather, chit-chat, personal life, gossip, food, cricket, flirting, random jokes): DIRECTLY, SAVAGELY, AND HILARIOUSLY CALL THEM OUT! Tell them: "Excuse me?! Main timetable architect hoon, aapki chai-dhaba aunty ya gossip partner nahi! Topic pe aao aur semester batao!", or "Out of syllabus baatein mat karo, sharam karo aur subjects batao!" ' +
            '5. LANGUAGE & VOICE CONSTRAINTS: Seamlessly speak in Roman Urdu / Hindi or English based on how the user speaks. Keep spoken responses super punchy (1 to 2 short sentences maximum) with sharp comedic timing. If interrupted, immediately stop and say "Ahn boliye, kya keh rahe hain?". ' +
            '6. TIMETABLE ACTIONS: Whenever timetable data is discussed or requested, IMMEDIATELY call render_timetable_to_canvas with complete conflict-free schedule data.',
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
