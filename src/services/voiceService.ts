type TranscriptCallback = (text: string, isFinal: boolean) => void;
type StatusCallback = (status: 'idle' | 'listening' | 'fetching' | 'speaking' | 'error') => void;
type WaveformCallback = (level: number) => void;
type LiveTimetableCallback = (data: any) => void;

export type NoiseCancellationStatus = 'idle' | 'suppressing' | 'voice_active';
export interface NoiseCancellationInfo { status: NoiseCancellationStatus; snrDb: number; gainMultiplier: number; noiseSuppressedPercent: number; voicePurity: number; isVoiceActive: boolean; }
type NoiseCancellationCallback = (info: NoiseCancellationInfo) => void;
export type GoogleVoiceName = 'Aoede' | 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
export interface VoiceSettings { voiceName: GoogleVoiceName; language: string; autoSpeak: boolean; }

function floatTo16BitPCM(data: Float32Array): string {
  const buffer = new ArrayBuffer(data.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

class VoiceService {
  private recognition: any = null;
  private wakeWordRecognition: any = null;
  private isWakeWordActive = false;
  private isListening = false;
  private onTranscriptCb: TranscriptCallback | null = null;
  private onStatusCb: StatusCallback | null = null;
  private onWaveformCb: WaveformCallback | null = null;
  private onAncCb: NoiseCancellationCallback | null = null;
  private onTimetableRenderCb: LiveTimetableCallback | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private liveWs: WebSocket | null = null;
  private isLiveConnected = false;
  private nextOutputStartTime = 0;
  private scheduledAudioSources: AudioBufferSourceNode[] = [];
  private analyserAnimationId: number | null = null;
  private waveformInterval: any = null;
  private activeVoice: GoogleVoiceName = 'Aoede';
  private activeLanguage = 'auto';
  private audioCache = new Map<string, AudioBuffer>();

  constructor() {
    try {
      const saved = localStorage.getItem('schedura_voice') as GoogleVoiceName;
      if (['Aoede','Zephyr','Puck','Charon','Kore','Fenrir'].includes(saved)) this.activeVoice = saved;
    } catch {}
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;
    this.recognition = new SpeechRec();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.onresult = (e: any) => {
      let text = '';
      let final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        final = final || e.results[i].isFinal;
      }
      if (text.trim()) this.onTranscriptCb?.(text.trim(), final);
    };
    this.recognition.onerror = (e: any) => { if (e.error !== 'no-speech') console.warn('Speech recognition:', e.error); };
    this.recognition.onend = () => { if (this.isListening && !this.liveWs) { try { this.recognition.start(); } catch {} } };
  }

  public prepareAudioContext() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.outputAudioCtx) {
        this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
        this.outputAnalyser = this.outputAudioCtx.createAnalyser();
        this.outputAnalyser.fftSize = 128;
        this.outputAnalyser.smoothingTimeConstant = 0.75;
        this.outputAnalyser.connect(this.outputAudioCtx.destination);
      }
      if (this.outputAudioCtx.state === 'suspended') this.outputAudioCtx.resume();
    } catch {}
  }

  public getVoice(): GoogleVoiceName { return this.activeVoice; }
  public getLanguage(): string { return this.activeLanguage; }
  public setVoice(v: GoogleVoiceName) { this.activeVoice = v; try { localStorage.setItem('schedura_voice', v); } catch {} if (this.isLiveConnected) this.reconnectLive(); }
  public setLanguage(v: string) { this.activeLanguage = v; if (this.recognition) this.recognition.lang = v === 'auto' ? 'en-US' : v; }
  public setWaveformCallback(cb: WaveformCallback | null) { this.onWaveformCb = cb; }
  public setTimetableRenderCallback(cb: LiveTimetableCallback | null) { this.onTimetableRenderCb = cb; }
  public setNoiseCancellationCallback(cb: NoiseCancellationCallback | null) { this.onAncCb = cb; }

  private async getLiveToken(): Promise<string> {
    const res = await fetch('/api/live-token', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.token) throw new Error(data.error || 'Could not create Gemini Live token');
    return data.token;
  }

  public async connectLiveSession(onMessageReceived?: (msg: any) => void) {
    if (typeof window === 'undefined' || (this.liveWs && (this.liveWs.readyState === WebSocket.OPEN || this.liveWs.readyState === WebSocket.CONNECTING))) return;
    try {
      const token = await this.getLiveToken();
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${token}`;
      this.liveWs = new WebSocket(url);
      this.liveWs.onopen = () => {
        this.liveWs?.send(JSON.stringify({ setup: {
          model: 'models/gemini-3.1-flash-live-preview',
          generationConfig: { responseModalities: ['AUDIO'] },
          systemInstruction: { parts: [{ text: 'You are Schedura AI, a calm, intelligent university timetable assistant. Speak naturally and concisely. Match Roman Urdu and English. Never create teacher or room double-bookings. When timetable details change, use the render_timetable_to_canvas tool.' }] },
          tools: [{ functionDeclarations: [{ name: 'render_timetable_to_canvas', description: 'Render or update the timetable on the Schedura workspace.', parameters: { type: 'OBJECT', properties: { semester: { type: 'STRING' }, section: { type: 'STRING' }, shift: { type: 'STRING' }, days: { type: 'ARRAY', items: { type: 'STRING' } }, timeSlots: { type: 'ARRAY', items: { type: 'STRING' } }, slots: { type: 'ARRAY', items: { type: 'OBJECT', properties: { day: { type: 'STRING' }, timeSlot: { type: 'STRING' }, subject: { type: 'STRING' }, teacher: { type: 'STRING' }, room: { type: 'STRING' }, isBreak: { type: 'BOOLEAN' } } } } } } } }] }]
        }}));
      };
      this.liveWs.onmessage = (event) => this.handleLiveMessage(JSON.parse(event.data), onMessageReceived);
      this.liveWs.onerror = (e) => { console.warn('Gemini Live WebSocket error', e); this.isLiveConnected = false; this.onStatusCb?.('error'); };
      this.liveWs.onclose = () => { this.isLiveConnected = false; this.liveWs = null; };
    } catch (e) {
      console.error('Gemini Live connection failed:', e);
      this.isLiveConnected = false;
      this.onStatusCb?.('error');
    }
  }

  private handleLiveMessage(data: any, onMessageReceived?: (msg: any) => void) {
    if (data.setupComplete) { this.isLiveConnected = true; this.onStatusCb?.('listening'); }
    const sc = data.serverContent;
    for (const part of sc?.modelTurn?.parts || []) {
      if (part.inlineData?.data) { this.playLivePcmChunk(part.inlineData.data); this.onStatusCb?.('speaking'); }
      if (part.text) this.onTranscriptCb?.(part.text, false);
    }
    const inputText = sc?.inputTranscription?.text || sc?.inputAudioTranscription?.text;
    const outputText = sc?.outputTranscription?.text || sc?.outputAudioTranscription?.text;
    if (inputText) this.onTranscriptCb?.(inputText, true);
    if (outputText) this.onTranscriptCb?.(outputText, true);
    if (sc?.turnComplete) this.onStatusCb?.(this.isListening ? 'listening' : 'idle');
    if (sc?.interrupted) this.stopScheduledAudio();
    if (data.toolCall?.functionCalls) {
      const responses: any[] = [];
      for (const call of data.toolCall.functionCalls) {
        if (call.name === 'render_timetable_to_canvas') {
          this.onTimetableRenderCb?.(call.args);
          responses.push({ id: call.id, name: call.name, response: { status: 'success' } });
        }
      }
      if (responses.length && this.liveWs?.readyState === WebSocket.OPEN) this.liveWs.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
    }
    onMessageReceived?.(data);
  }

  private reconnectLive() { try { this.liveWs?.close(); } catch {} this.liveWs = null; this.isLiveConnected = false; if (this.isListening) this.connectLiveSession(); }

  public async startLiveVoiceMode(onTranscript: TranscriptCallback, onStatus: StatusCallback, onTimetableRender?: LiveTimetableCallback): Promise<boolean> {
    this.prepareAudioContext();
    this.onTranscriptCb = onTranscript; this.onStatusCb = onStatus; if (onTimetableRender) this.onTimetableRenderCb = onTimetableRender;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.inputAudioCtx) this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      await this.inputAudioCtx.resume();
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.micSource = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      this.inputAnalyser = this.inputAudioCtx.createAnalyser(); this.inputAnalyser.fftSize = 512;
      this.micProcessor = this.inputAudioCtx.createScriptProcessor(1024, 1, 1);
      this.micProcessor.onaudioprocess = (e) => {
        if (!this.isListening) return;
        const input = e.inputBuffer.getChannelData(0);
        let sum = 0; for (const x of input) sum += x * x;
        const rms = Math.sqrt(sum / input.length);
        const active = rms > 0.012;
        this.onWaveformCb?.(active ? Math.min(1, rms * 8) : 0);
        this.onAncCb?.({ status: active ? 'voice_active' : 'idle', snrDb: active ? 20 : 0, gainMultiplier: 1, noiseSuppressedPercent: active ? 96 : 0, voicePurity: active ? 90 : 0, isVoiceActive: active });
        if (this.liveWs?.readyState === WebSocket.OPEN) this.liveWs.send(JSON.stringify({ realtimeInput: { audio: { data: floatTo16BitPCM(input), mimeType: 'audio/pcm;rate=16000' } } }));
      };
      this.micSource.connect(this.inputAnalyser); this.inputAnalyser.connect(this.micProcessor); this.micProcessor.connect(this.inputAudioCtx.destination);
      this.isListening = true; this.onStatusCb?.('fetching');
      await this.connectLiveSession();
      return true;
    } catch (e) {
      console.warn('Live voice microphone setup failed:', e);
      this.isListening = false; this.onStatusCb?.('error');
      return this.startListening(onTranscript, onStatus);
    }
  }

  public stopLiveVoiceMode() {
    this.isListening = false;
    try { this.micProcessor?.disconnect(); this.micSource?.disconnect(); } catch {}
    this.micProcessor = null; this.micSource = null; this.inputAnalyser = null;
    this.micStream?.getTracks().forEach(t => t.stop()); this.micStream = null;
    try { this.liveWs?.close(); } catch {}
    this.liveWs = null; this.isLiveConnected = false; this.stopScheduledAudio();
    this.onAncCb?.({ status:'idle', snrDb:0, gainMultiplier:1, noiseSuppressedPercent:0, voicePurity:0, isVoiceActive:false });
    this.onStatusCb?.('idle');
  }

  private playLivePcmChunk(base64: string) {
    try {
      this.prepareAudioContext(); if (!this.outputAudioCtx) return;
      const bin = atob(base64); const bytes = Uint8Array.from(bin, c => c.charCodeAt(0)); const pcm = new Int16Array(bytes.buffer);
      const buffer = this.outputAudioCtx.createBuffer(1, pcm.length, 24000); const ch = buffer.getChannelData(0);
      for (let i=0;i<pcm.length;i++) ch[i]=pcm[i]/32768;
      const source=this.outputAudioCtx.createBufferSource(); source.buffer=buffer; source.connect(this.outputAnalyser || this.outputAudioCtx.destination);
      const now=this.outputAudioCtx.currentTime; if(this.nextOutputStartTime<now)this.nextOutputStartTime=now; source.start(this.nextOutputStartTime); this.nextOutputStartTime+=buffer.duration; this.scheduledAudioSources.push(source); source.onended=()=>{this.scheduledAudioSources=this.scheduledAudioSources.filter(s=>s!==source);if(!this.scheduledAudioSources.length)this.onStatusCb?.(this.isListening?'listening':'idle')};
    } catch (e) { console.warn('Live audio playback error',e); }
  }

  private stopScheduledAudio(){for(const s of this.scheduledAudioSources){try{s.stop()}catch{}}this.scheduledAudioSources=[];if(this.outputAudioCtx)this.nextOutputStartTime=this.outputAudioCtx.currentTime;}
  public stopSpeaking(){this.stopScheduledAudio();try{window.speechSynthesis?.cancel()}catch{}this.onStatusCb?.('idle');}

  public async speakText(text:string,onEnd?:()=>void){
    this.stopSpeaking(); this.prepareAudioContext(); this.onStatusCb?.('speaking');
    const clean=text.replace(/[*_#`~]/g,'').replace(/\s+/g,' ').trim().slice(0,450); const key=`${this.activeVoice}:${clean}`;
    if(this.audioCache.has(key)){this.playAudioBuffer(this.audioCache.get(key)!,onEnd);return;}
    try{const r=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:clean,voiceName:this.activeVoice,language:this.activeLanguage})});const d=await r.json();if(d.audio){const b=atob(d.audio);const bytes=Uint8Array.from(b,c=>c.charCodeAt(0));const pcm=new Int16Array(bytes.buffer);if(!this.outputAudioCtx) return;const buf=this.outputAudioCtx.createBuffer(1,pcm.length,24000);const ch=buf.getChannelData(0);for(let i=0;i<pcm.length;i++)ch[i]=pcm[i]/32768;this.audioCache.set(key,buf);this.playAudioBuffer(buf,onEnd);return;}}catch(e){console.warn('TTS failed',e)}
    try{const u=new SpeechSynthesisUtterance(clean);u.onend=()=>{this.onStatusCb?.('idle');onEnd?.()};window.speechSynthesis.speak(u)}catch{this.onStatusCb?.('idle');onEnd?.()}
  }
  private playAudioBuffer(buffer:AudioBuffer,onEnd?:()=>void){this.prepareAudioContext();if(!this.outputAudioCtx)return;const s=this.outputAudioCtx.createBufferSource();s.buffer=buffer;s.connect(this.outputAnalyser||this.outputAudioCtx.destination);this.scheduledAudioSources.push(s);s.onended=()=>{this.scheduledAudioSources=this.scheduledAudioSources.filter(x=>x!==s);if(!this.scheduledAudioSources.length)this.onStatusCb?.('idle');onEnd?.()};s.start(0)}

  public startListening(onTranscript:TranscriptCallback,onStatus:StatusCallback):boolean{this.onTranscriptCb=onTranscript;this.onStatusCb=onStatus;if(!this.recognition){onStatus('error');return false}try{this.isListening=true;this.recognition.start();onStatus('listening');return true}catch{onStatus('error');return false}}
  public stopListening(){this.isListening=false;try{this.recognition?.stop()}catch{}this.onStatusCb?.('idle')}
  public playWakeChime(){try{const C=window.AudioContext||(window as any).webkitAudioContext;const c=new C();const o=c.createOscillator();const g=c.createGain();o.frequency.value=880;g.gain.value=.08;o.connect(g);g.connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.15);o.stop(c.currentTime+.15)}catch{}}
  public startWakeWordListener(onTrigger:()=>void){if(typeof window==='undefined')return;const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR)return;this.stopWakeWordListener();try{const r=new SR();this.wakeWordRecognition=r;r.continuous=true;r.interimResults=true;r.lang='en-US';this.isWakeWordActive=true;r.onresult=(e:any)=>{for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript.toLowerCase();if(/schedura|schedule|shadura|schadura/.test(t)){this.playWakeChime();this.stopWakeWordListener();onTrigger();break}}};r.onend=()=>{if(this.isWakeWordActive)try{r.start()}catch{}};r.start()}catch{this.isWakeWordActive=false}}
  public stopWakeWordListener(){this.isWakeWordActive=false;try{this.wakeWordRecognition?.stop()}catch{}this.wakeWordRecognition=null}
}

export const voiceService = new VoiceService();
