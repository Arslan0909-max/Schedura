// High-Fidelity Google AI Gemini 3.1 Flash Live Preview & Audio Pipeline

type TranscriptCallback = (text: string, isFinal: boolean) => void;
type StatusCallback = (status: 'idle' | 'listening' | 'fetching' | 'speaking' | 'error') => void;
type WaveformCallback = (level: number) => void;
type LiveTimetableCallback = (data: any) => void;

export type GoogleVoiceName = 'Aoede' | 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

export interface VoiceSettings {
  voiceName: GoogleVoiceName;
  language: string;
  autoSpeak: boolean;
}

interface EmotionalInflection {
  pitch: number;
  rate: number;
  volume: number;
  tone: 'celebratory' | 'inquisitive' | 'warning' | 'authoritative' | 'friendly';
}

function floatTo16BitPCM(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

class VoiceService {
  // Speech Recognition fallback
  private recognition: any = null;
  private isListening = false;
  private onTranscriptCb: TranscriptCallback | null = null;
  private onStatusCb: StatusCallback | null = null;
  private onWaveformCb: WaveformCallback | null = null;
  private onTimetableRenderCb: LiveTimetableCallback | null = null;
  private waveformInterval: any = null;
  private chromeKeepAliveTimer: any = null;

  // Audio Contexts for Live API
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private analyserAnimationId: number | null = null;
  private micStream: MediaStream | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private nextOutputStartTime = 0;
  private scheduledAudioSources: AudioBufferSourceNode[] = [];

  // Live WebSocket
  private liveWs: WebSocket | null = null;
  private isLiveConnected = false;

  // Settings
  private activeVoice: GoogleVoiceName = (() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('schedura_voice') as GoogleVoiceName;
        const valid: GoogleVoiceName[] = ['Aoede', 'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
        if (saved && valid.includes(saved)) return saved;
      }
    } catch {
      // ignore
    }
    return 'Aoede';
  })();
  private activeLanguage: string = 'auto';

  // Cache
  private audioCache = new Map<string, AudioBuffer>();
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.initVoices();
    this.initRecognition();
  }

  public prepareAudioContext() {
    try {
      if (!this.outputAudioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
        this.outputAnalyser = this.outputAudioCtx.createAnalyser();
        this.outputAnalyser.fftSize = 128;
        this.outputAnalyser.smoothingTimeConstant = 0.75;
        this.outputAnalyser.connect(this.outputAudioCtx.destination);
      }
      if (this.outputAudioCtx.state === 'suspended') {
        this.outputAudioCtx.resume();
      }
    } catch {
      // ignore
    }
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.cachedVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      this.cachedVoices = window.speechSynthesis.getVoices();
    };
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.activeLanguage === 'auto' ? 'en-US' : this.activeLanguage;

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        if (text && this.onTranscriptCb) {
          this.onTranscriptCb(text, !!finalTranscript);
        }
      };

      this.recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn('Speech recognition status:', e.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch {
            // ignore
          }
        }
      };
    }
  }

  public setVoice(voiceName: GoogleVoiceName) {
    this.activeVoice = voiceName;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('schedura_voice', voiceName);
      }
    } catch {
      // ignore
    }

    // If live session is active, reconnect cleanly with the newly selected voice
    if (this.isLiveConnected && this.liveWs) {
      try {
        this.liveWs.close();
      } catch {
        // ignore
      }
      this.liveWs = null;
      this.isLiveConnected = false;
      this.connectLiveSession();
    }
  }

  public getVoice(): GoogleVoiceName {
    return this.activeVoice;
  }

  public setLanguage(lang: string) {
    this.activeLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang === 'auto' ? 'en-US' : lang;
    }
  }

  public getLanguage(): string {
    return this.activeLanguage;
  }

  public setWaveformCallback(cb: WaveformCallback | null) {
    this.onWaveformCb = cb;
  }

  public setTimetableRenderCallback(cb: LiveTimetableCallback | null) {
    this.onTimetableRenderCb = cb;
  }

  // Connect to Gemini 3.1 Flash Live Preview via WebSocket
  public connectLiveSession(onMessageReceived?: (msg: any) => void) {
    if (typeof window === 'undefined') return;

    if (this.liveWs && (this.liveWs.readyState === WebSocket.OPEN || this.liveWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live?voice=${encodeURIComponent(this.activeVoice)}`;
      this.liveWs = new WebSocket(wsUrl);

      this.liveWs.onopen = () => {
        this.isLiveConnected = true;
      };

      this.liveWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'audio' && data.audio) {
            // Play natural Google AI audio chunk through 24kHz AudioContext
            this.playLivePcmChunk(data.audio);
            this.onStatusCb?.('speaking');
          } else if (data.type === 'turn_complete') {
            if (this.scheduledAudioSources.length === 0) {
              this.onStatusCb?.(this.isListening ? 'listening' : 'idle');
            }
          } else if (data.type === 'interrupted') {
            this.stopScheduledAudio();
          } else if (data.type === 'timetable_render' && data.timetableData) {
            this.onTimetableRenderCb?.(data.timetableData);
          } else if (data.type === 'transcription' && data.text) {
            if (this.onTranscriptCb) {
              this.onTranscriptCb(data.text, true);
            }
          }

          onMessageReceived?.(data);
        } catch {
          // ignore
        }
      };

      this.liveWs.onclose = () => {
        this.isLiveConnected = false;
        this.liveWs = null;
      };

      this.liveWs.onerror = () => {
        this.isLiveConnected = false;
      };
    } catch {
      this.isLiveConnected = false;
    }
  }

  // Start Hyper-Realistic Live Voice Mode with Gemini 3.1 Flash Live Preview model
  public async startLiveVoiceMode(
    onTranscript: TranscriptCallback,
    onStatus: StatusCallback,
    onTimetableRender?: LiveTimetableCallback
  ): Promise<boolean> {
    this.prepareAudioContext();
    this.onTranscriptCb = onTranscript;
    this.onStatusCb = onStatus;
    if (onTimetableRender) {
      this.onTimetableRenderCb = onTimetableRender;
    }

    this.connectLiveSession();
    this.isListening = true;
    this.onStatusCb?.('listening');

    // Initialize Microphone AudioContext at 16kHz for Gemini 3.1 Flash Live Preview
    try {
      if (!this.inputAudioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      }
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micStream = stream;
      this.micSource = this.inputAudioCtx.createMediaStreamSource(stream);

      // Acoustic noise isolation filter chain (Highpass 85Hz for rumble + Lowpass 3800Hz for speech band)
      const highpassFilter = this.inputAudioCtx.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.value = 85;

      const lowpassFilter = this.inputAudioCtx.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.value = 3800;

      // Use 1024 buffer size for ultra-low latency (~64ms audio chunk streaming)
      this.micProcessor = this.inputAudioCtx.createScriptProcessor(1024, 1, 1);

      this.micProcessor.onaudioprocess = (e) => {
        if (!this.isListening) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate instantaneous RMS volume level for noise gating & visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const level = Math.min(1.0, rms * 6.0);
        this.onWaveformCb?.(level);

        // Barge-In Interruption Detection: If user speaks while model is playing audio, interrupt immediately
        if (rms > 0.028 && this.scheduledAudioSources.length > 0) {
          this.stopScheduledAudio();
          if (this.liveWs && this.liveWs.readyState === WebSocket.OPEN) {
            this.liveWs.send(JSON.stringify({ type: 'interrupted' }));
          }
        }

        // Noise gate: only send stream when speech signal is present or during live connection
        if (this.liveWs && this.liveWs.readyState === WebSocket.OPEN) {
          const base64 = floatTo16BitPCM(inputData);
          this.liveWs.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };

      // Connect filter chain
      this.micSource.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(this.micProcessor);
      this.micProcessor.connect(this.inputAudioCtx.destination);
      return true;
    } catch (micErr) {
      console.warn('Microphone stream setup info, using recognition fallback:', micErr);
      return this.startListening(onTranscript, onStatus);
    }
  }

  public stopLiveVoiceMode() {
    this.isListening = false;
    this.stopWaveformAnimation();
    this.stopScheduledAudio();

    if (this.micProcessor && this.micSource) {
      try {
        this.micSource.disconnect();
        this.micProcessor.disconnect();
      } catch {
        // ignore
      }
      this.micProcessor = null;
      this.micSource = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }

    if (this.liveWs) {
      try {
        this.liveWs.close();
      } catch {
        // ignore
      }
      this.liveWs = null;
    }

    this.onStatusCb?.('idle');
  }

  // Play Live PCM Chunk with gapless scheduling
  private playLivePcmChunk(base64Pcm: string) {
    try {
      if (!this.outputAudioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      }

      const binary = atob(base64Pcm);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      const audioBuffer = this.outputAudioCtx.createBuffer(1, int16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < int16.length; i++) {
        channelData[i] = int16[i] / 32768.0;
      }

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      if (this.outputAnalyser) {
        source.connect(this.outputAnalyser);
      } else {
        source.connect(this.outputAudioCtx.destination);
      }

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextOutputStartTime < currentTime) {
        this.nextOutputStartTime = currentTime;
      }

      source.start(this.nextOutputStartTime);
      this.nextOutputStartTime += audioBuffer.duration;

      this.startOutputAnalyserLoop();

      this.scheduledAudioSources.push(source);
      source.onended = () => {
        const idx = this.scheduledAudioSources.indexOf(source);
        if (idx !== -1) {
          this.scheduledAudioSources.splice(idx, 1);
        }
        if (this.scheduledAudioSources.length === 0) {
          this.stopOutputAnalyserLoop();
          this.onStatusCb?.(this.isListening ? 'listening' : 'idle');
        }
      };
    } catch (err) {
      console.warn('Error playing Live audio chunk:', err);
    }
  }

  private startOutputAnalyserLoop() {
    if (this.analyserAnimationId || !this.outputAnalyser) return;
    const bufferLength = this.outputAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAnalysis = () => {
      if (this.outputAnalyser && this.scheduledAudioSources.length > 0) {
        this.outputAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        // Scale level dynamically for realistic visual reaction
        const level = Math.min(1.0, (avg / 110.0));
        if (level > 0.01) {
          this.onWaveformCb?.(level);
        }
        this.analyserAnimationId = requestAnimationFrame(checkAnalysis);
      } else {
        this.analyserAnimationId = null;
        this.onWaveformCb?.(0);
      }
    };
    this.analyserAnimationId = requestAnimationFrame(checkAnalysis);
  }

  private stopOutputAnalyserLoop() {
    if (this.analyserAnimationId) {
      cancelAnimationFrame(this.analyserAnimationId);
      this.analyserAnimationId = null;
    }
    this.onWaveformCb?.(0);
  }

  private stopScheduledAudio() {
    this.stopOutputAnalyserLoop();
    for (const source of this.scheduledAudioSources) {
      try {
        source.stop();
      } catch {
        // ignore
      }
    }
    this.scheduledAudioSources = [];
    if (this.outputAudioCtx) {
      this.nextOutputStartTime = this.outputAudioCtx.currentTime;
    }
  }

  // Fallback speech recognition
  public startListening(onTranscript: TranscriptCallback, onStatus: StatusCallback): boolean {
    this.prepareAudioContext();
    this.onTranscriptCb = onTranscript;
    this.onStatusCb = onStatus;

    if (!this.recognition) {
      onStatus('error');
      return false;
    }

    try {
      this.stopSpeaking();
      this.isListening = true;
      this.recognition.start();
      this.onStatusCb?.('listening');
      this.startWaveformAnimation();
      return true;
    } catch {
      this.isListening = false;
      this.onStatusCb?.('error');
      return false;
    }
  }

  public stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.stopWaveformAnimation();
    this.onStatusCb?.('idle');
  }

  // Analyzes emotion for speech synthesis
  private analyzeEmotion(text: string): EmotionalInflection {
    const clean = text.toLowerCase();

    if (
      clean.includes('done!') ||
      clean.includes('rendered') ||
      clean.includes('populated') ||
      clean.includes('congratulations') ||
      clean.includes('success') ||
      clean.includes('ready!')
    ) {
      return { pitch: 1.14, rate: 1.05, volume: 1.0, tone: 'celebratory' };
    }

    if (
      clean.includes('conflict') ||
      clean.includes('clash') ||
      clean.includes('warning') ||
      clean.includes('double-book')
    ) {
      return { pitch: 0.94, rate: 0.96, volume: 1.0, tone: 'warning' };
    }

    if (text.includes('?') || clean.includes('would you like') || clean.includes('which')) {
      return { pitch: 1.08, rate: 1.02, volume: 1.0, tone: 'inquisitive' };
    }

    return { pitch: 1.04, rate: 1.02, volume: 1.0, tone: 'friendly' };
  }

  // Speak text with Google AI Voice Model with zero-latency audio pipeline
  public async speakText(text: string, onEnd?: () => void) {
    this.stopSpeaking();
    this.prepareAudioContext();
    this.onStatusCb?.('speaking');
    this.startWaveformAnimation();

    const cleanText = text
      .replace(/[*_#`~]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const shortSpokenText = cleanText.slice(0, 420);
    const emotionInfo = this.analyzeEmotion(shortSpokenText);

    // Check zero-latency audio cache first
    const cacheKey = `${this.activeVoice}:${this.activeLanguage}:${shortSpokenText}`;
    if (this.audioCache.has(cacheKey) && this.outputAudioCtx) {
      const cachedBuffer = this.audioCache.get(cacheKey)!;
      this.playAudioBuffer(cachedBuffer, onEnd);
      return;
    }

    // Call high-fidelity Google AI Voice Model
    let hasPlayed = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: shortSpokenText,
          voiceName: this.activeVoice,
          emotion: emotionInfo.tone,
          language: this.activeLanguage,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.audio && data.format === 'pcm_24k') {
          hasPlayed = true;
          await this.playBase64Pcm(data.audio, cacheKey, onEnd);
          return;
        }
      }
    } catch {
      // Seamlessly continue with instant client speech
    }

    if (!hasPlayed) {
      this.speakWithAdvancedWebSpeech(shortSpokenText, onEnd);
    }
  }

  private speakWithAdvancedWebSpeech(text: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.stopWaveformAnimation();
      this.onStatusCb?.('idle');
      onEnd?.();
      return;
    }

    window.speechSynthesis.cancel();

    const clauses = text
      .split(/(?<=[.?!,;—])\s+/)
      .map((c) => c.trim())
      .filter(Boolean);

    if (clauses.length === 0) {
      this.stopWaveformAnimation();
      this.onStatusCb?.('idle');
      onEnd?.();
      return;
    }

    const bestVoice = this.getBestVoice();
    let currentClauseIdx = 0;

    this.chromeKeepAliveTimer = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);

    const speakNextClause = () => {
      if (currentClauseIdx >= clauses.length) {
        this.clearKeepAlive();
        this.stopWaveformAnimation();
        this.onStatusCb?.('idle');
        onEnd?.();
        return;
      }

      const clauseText = clauses[currentClauseIdx];
      const inflection = this.analyzeEmotion(clauseText);
      const utterance = new SpeechSynthesisUtterance(clauseText);

      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      utterance.pitch = inflection.pitch;
      utterance.rate = inflection.rate;
      utterance.volume = inflection.volume;

      if (clauseText.endsWith('?')) {
        utterance.pitch = Math.min(1.3, inflection.pitch + 0.08);
      }

      utterance.onend = () => {
        currentClauseIdx++;
        setTimeout(speakNextClause, 60);
      };

      utterance.onerror = () => {
        this.clearKeepAlive();
        this.stopWaveformAnimation();
        this.onStatusCb?.('idle');
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextClause();
  }

  private getBestVoice(): SpeechSynthesisVoice | null {
    if (this.cachedVoices.length === 0 && 'speechSynthesis' in window) {
      this.cachedVoices = window.speechSynthesis.getVoices();
    }

    const voices = this.cachedVoices;
    if (!voices || voices.length === 0) return null;

    const langPrefix = this.activeLanguage !== 'auto' ? this.activeLanguage.split('-')[0] : 'en';

    const priorities = [
      (v: SpeechSynthesisVoice) => v.name.includes('Natural') && v.lang.startsWith(langPrefix),
      (v: SpeechSynthesisVoice) => v.name.includes('Online') && v.lang.startsWith(langPrefix),
      (v: SpeechSynthesisVoice) => v.name.includes('Google') && v.lang.startsWith(langPrefix),
      (v: SpeechSynthesisVoice) => v.name.includes('Samantha') && v.lang.startsWith(langPrefix),
      (v: SpeechSynthesisVoice) => v.lang.startsWith(langPrefix),
      (v: SpeechSynthesisVoice) => v.lang.startsWith('en'),
    ];

    for (const test of priorities) {
      const match = voices.find(test);
      if (match) return match;
    }

    return voices[0] || null;
  }

  private clearKeepAlive() {
    if (this.chromeKeepAliveTimer) {
      clearInterval(this.chromeKeepAliveTimer);
      this.chromeKeepAliveTimer = null;
    }
  }

  public stopSpeaking() {
    this.clearKeepAlive();
    this.stopWaveformAnimation();
    this.stopScheduledAudio();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    this.onStatusCb?.('idle');
  }

  private playAudioBuffer(audioBuffer: AudioBuffer, onEnd?: () => void) {
    this.prepareAudioContext();
    if (!this.outputAudioCtx) return;

    const source = this.outputAudioCtx.createBufferSource();
    source.buffer = audioBuffer;
    if (this.outputAnalyser) {
      source.connect(this.outputAnalyser);
    } else {
      source.connect(this.outputAudioCtx.destination);
    }

    this.scheduledAudioSources.push(source);
    this.startOutputAnalyserLoop();

    source.onended = () => {
      const idx = this.scheduledAudioSources.indexOf(source);
      if (idx !== -1) {
        this.scheduledAudioSources.splice(idx, 1);
      }
      if (this.scheduledAudioSources.length === 0) {
        this.stopOutputAnalyserLoop();
        this.onStatusCb?.('idle');
      }
      onEnd?.();
    };

    source.start(0);
  }

  private async playBase64Pcm(base64: string, cacheKey?: string, onEnd?: () => void) {
    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (!this.outputAudioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      }

      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      const int16Array = new Int16Array(bytes.buffer);
      const audioBuffer = this.outputAudioCtx.createBuffer(1, int16Array.length, 24000);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      if (cacheKey && this.audioCache.size < 50) {
        this.audioCache.set(cacheKey, audioBuffer);
      }

      this.playAudioBuffer(audioBuffer, onEnd);
    } catch {
      this.stopWaveformAnimation();
      this.onStatusCb?.('idle');
      onEnd?.();
    }
  }

  private startWaveformAnimation() {
    this.stopWaveformAnimation();
    if (!this.onWaveformCb) return;

    this.waveformInterval = setInterval(() => {
      const energy = 0.35 + Math.random() * 0.65;
      this.onWaveformCb?.(energy);
    }, 90);
  }

  private stopWaveformAnimation() {
    if (this.waveformInterval) {
      clearInterval(this.waveformInterval);
      this.waveformInterval = null;
    }
    this.onWaveformCb?.(0);
  }
}

export const voiceService = new VoiceService();
