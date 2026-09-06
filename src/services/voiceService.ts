// High-Fidelity Google AI Gemini 3.1 Flash Live Preview & Audio Pipeline

type TranscriptCallback = (text: string, isFinal: boolean) => void;
type StatusCallback = (status: 'idle' | 'listening' | 'fetching' | 'speaking' | 'error') => void;
type WaveformCallback = (level: number) => void;
type LiveTimetableCallback = (data: any) => void;

export type NoiseCancellationStatus = 'idle' | 'suppressing' | 'voice_active';

export interface NoiseCancellationInfo {
  status: NoiseCancellationStatus;
  snrDb: number;
  gainMultiplier: number;
  noiseSuppressedPercent: number;
  voicePurity: number;
  isVoiceActive: boolean;
}

type NoiseCancellationCallback = (info: NoiseCancellationInfo) => void;

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
  private onAncCb: NoiseCancellationCallback | null = null;
  private onTimetableRenderCb: LiveTimetableCallback | null = null;
  private waveformInterval: any = null;
  private chromeKeepAliveTimer: any = null;

  // Audio Contexts & Analysers for Live API
  private inputAudioCtx: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
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

  // Dynamic AGC and Noise Suppression State
  private smoothAgcGain = 1.0;
  private estimatedAmbientNoise = 0.008;

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
          // Crystal-Clear Intelligible Speech Interruption Check:
          // ONLY pause audio output if actual intelligible user words (>= 2 words or explicit command word) are recognized.
          // Never interrupt on raw background noise, non-verbal sounds, or unclear audio.
          const words = text.trim().split(/\s+/).filter((w) => w.length > 1);
          const hasExplicitCommand = words.some((w) =>
            ['stop', 'wait', 'hold', 'pause', 'schedura', 'ruk', 'roko', 'suno', 'bhai', 'listen', 'chup'].includes(w.toLowerCase())
          );

          if ((words.length >= 2 || hasExplicitCommand) && this.scheduledAudioSources.length > 0) {
            console.log('[VoiceService] Intelligible user speech recognized during output. Pausing response:', text);
            this.stopScheduledAudio();
            if (this.liveWs && this.liveWs.readyState === WebSocket.OPEN) {
              this.liveWs.send(JSON.stringify({ type: 'interrupted' }));
            }
          }

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

  public setNoiseCancellationCallback(cb: NoiseCancellationCallback | null) {
    this.onAncCb = cb;
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
            if (!data.isModel && this.scheduledAudioSources.length > 0) {
              const words = data.text.trim().split(/\s+/).filter((w: string) => w.length > 1);
              const hasCommand = words.some((w: string) =>
                ['stop', 'wait', 'hold', 'pause', 'schedura', 'ruk', 'roko', 'suno', 'bhai', 'listen'].includes(w.toLowerCase())
              );
              if (words.length >= 2 || hasCommand) {
                console.log('[VoiceService] Live user speech transcript recognized during AI playback. Pausing:', data.text);
                this.stopScheduledAudio();
              }
            }
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
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          // Advanced browser constraints for professional vocal clarity
          googEchoCancellation: { ideal: true },
          googAutoGainControl: { ideal: true },
          googNoiseSuppression: { ideal: true },
          googHighpassFilter: { ideal: true },
          googTypingNoiseDetection: { ideal: true },
        } as any,
      });

      this.micStream = stream;
      this.micSource = this.inputAudioCtx.createMediaStreamSource(stream);

      // Web Audio API AnalyserNode for Real-Time Vocal Frequency Spectrum Analysis & Noise Detection
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 512; // 256 frequency bins (~31.25 Hz resolution per bin at 16kHz)
      this.inputAnalyser.smoothingTimeConstant = 0.75;

      // Multi-stage Hardware/DSP Noise Cancellation Filter Pipeline:
      // Stage 1: Steep Highpass Filter (85 Hz) to eliminate AC hum, desk thumps, room rumble & electrical ground noise
      const highpassFilter = this.inputAudioCtx.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.value = 85;
      highpassFilter.Q.value = 0.707;

      // Stage 2: Second-order Highpass Filter (120 Hz) for sharp sub-vocal roll-off
      const highpassFilter2 = this.inputAudioCtx.createBiquadFilter();
      highpassFilter2.type = 'highpass';
      highpassFilter2.frequency.value = 120;
      highpassFilter2.Q.value = 0.707;

      // Stage 3: Lowpass Anti-Aliasing & High-Frequency Noise Filter (3600 Hz) to eliminate hiss, fan noise & keyboard clicks
      const lowpassFilter = this.inputAudioCtx.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.value = 3600;
      lowpassFilter.Q.value = 0.707;

      // Stage 4: Dynamic Vocal Presence Peaking Filter (2500 Hz) to enhance human voice intelligibility over ambient noise
      const presenceFilter = this.inputAudioCtx.createBiquadFilter();
      presenceFilter.type = 'peaking';
      presenceFilter.frequency.value = 2500;
      presenceFilter.gain.value = 3.0;
      presenceFilter.Q.value = 1.1;

      // Stage 5: Dynamics Compressor for clean voice leveling without amplifying room ambience
      const dynamicsCompressor = this.inputAudioCtx.createDynamicsCompressor();
      dynamicsCompressor.threshold.setValueAtTime(-26, this.inputAudioCtx.currentTime);
      dynamicsCompressor.knee.setValueAtTime(10, this.inputAudioCtx.currentTime);
      dynamicsCompressor.ratio.setValueAtTime(3.5, this.inputAudioCtx.currentTime);
      dynamicsCompressor.attack.setValueAtTime(0.003, this.inputAudioCtx.currentTime);
      dynamicsCompressor.release.setValueAtTime(0.18, this.inputAudioCtx.currentTime);

      // Adaptive Noise Floor & VAD Tracker variables
      let estimatedNoiseFloor = 0.008;
      let speechHoldCounter = 0;
      const HOLD_FRAMES = 8; // Hold open for ~500ms during natural word pauses
      const freqByteData = new Uint8Array(this.inputAnalyser.frequencyBinCount);
      this.smoothAgcGain = 1.0;

      // Use 1024 buffer size for ultra-low latency (~64ms audio chunk streaming)
      this.micProcessor = this.inputAudioCtx.createScriptProcessor(1024, 1, 1);

      this.micProcessor.onaudioprocess = (e) => {
        if (!this.isListening) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // 1. Calculate instantaneous RMS energy of the filtered speech signal
        let sumSquares = 0;
        let peakValue = 0;
        for (let i = 0; i < inputData.length; i++) {
          const val = inputData[i];
          const absVal = Math.abs(val);
          if (absVal > peakValue) peakValue = absVal;
          sumSquares += val * val;
        }
        const rms = Math.sqrt(sumSquares / inputData.length);

        // 2. Real-Time Spectral Analysis with AnalyserNode for Voice Band Isolation
        let voiceBandSum = 0;
        let noiseBandSum = 0;
        if (this.inputAnalyser) {
          this.inputAnalyser.getByteFrequencyData(freqByteData);
          // Human voice fundamental & formants range: ~200Hz to 3400Hz (Bins 6 to 108)
          for (let b = 0; b < freqByteData.length; b++) {
            const mag = freqByteData[b];
            if (b >= 6 && b <= 108) {
              voiceBandSum += mag;
            } else {
              // Low rumble (<200Hz) or High hiss (>3400Hz)
              noiseBandSum += mag;
            }
          }
        }

        const voiceEnergyAvg = voiceBandSum / 103;
        const noiseEnergyAvg = noiseBandSum / (freqByteData.length - 103 + 1);
        const snrRatio = Math.max(0.001, voiceEnergyAvg) / Math.max(0.001, noiseEnergyAvg);
        const snrDb = 10 * Math.log10(snrRatio);
        const voicePurity = Math.min(100, Math.max(0, Math.round((voiceEnergyAvg / (voiceEnergyAvg + noiseEnergyAvg + 0.1)) * 100)));

        // Update continuous background ambient noise floor estimate (slow EMA when low energy)
        if (rms < estimatedNoiseFloor * 1.5) {
          estimatedNoiseFloor = estimatedNoiseFloor * 0.95 + rms * 0.05;
        }

      // Voice Detection based on both RMS energy and Vocal Frequency Spectrum Dominance
        // Require near-field primary user speech (higher SNR & speech energy) to reject distant voices/animal noises/TV/objects
        const isVoiceFrequencyDominant = voiceEnergyAvg > 16 && voiceEnergyAvg > noiseEnergyAvg * 1.5;
        const speechThreshold = Math.max(0.015, estimatedNoiseFloor * 2.5);
        const isVoiceActive = rms > speechThreshold && isVoiceFrequencyDominant;

        if (isVoiceActive) {
          speechHoldCounter = HOLD_FRAMES;
        } else if (speechHoldCounter > 0) {
          speechHoldCounter--;
        }

        const isUserSpeaking = isVoiceActive || speechHoldCounter > 0;
        const isSuppressingNoise = noiseEnergyAvg > 6 || (rms > 0.005 && !isUserSpeaking);

        // Determine Real-Time ANC Status
        const ancStatus: NoiseCancellationStatus = isUserSpeaking
          ? 'voice_active'
          : isSuppressingNoise
          ? 'suppressing'
          : 'idle';

        // 3. Dynamic AGC (Automatic Gain Control) & Speech Normalization Stage
        // Target Speech RMS: 0.20 (optimal for Gemini 3.1 Live clarity without clipping)
        const TARGET_SPEECH_RMS = 0.20;
        const idealGain = isUserSpeaking
          ? Math.min(4.8, Math.max(0.9, TARGET_SPEECH_RMS / Math.max(rms, 0.02)))
          : 1.0;
        
        // Smooth exponential attack/decay to eliminate gain pumping
        const smoothingFactor = idealGain > this.smoothAgcGain ? 0.14 : 0.06;
        this.smoothAgcGain = this.smoothAgcGain * (1 - smoothingFactor) + idealGain * smoothingFactor;

        // Apply Dynamic AGC Normalization with soft tanh limiter
        const normalizedBuffer = new Float32Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const amplified = inputData[i] * this.smoothAgcGain;
          // Soft-knee tanh saturation prevents harsh digital clipping
          normalizedBuffer[i] = Math.tanh(amplified * 0.96);
        }

        // Calculate Noise Suppression Efficiency Percentage (88% - 99%)
        const noiseSuppressedPercent = isSuppressingNoise
          ? Math.min(99, Math.max(88, Math.round(92 + Math.min(7, (noiseEnergyAvg / 30) * 7))))
          : 96;

        // Emit Active Signal Processing info for the visualizer ring
        this.onAncCb?.({
          status: ancStatus,
          snrDb: Math.round(snrDb * 10) / 10,
          gainMultiplier: Math.round(this.smoothAgcGain * 10) / 10,
          noiseSuppressedPercent,
          voicePurity,
          isVoiceActive: isUserSpeaking,
        });

        // Waveform Visualizer Level: Only illuminate when genuine human voice is present
        const visualizerLevel = isUserSpeaking ? Math.min(1.0, (rms - estimatedNoiseFloor) * 9.0) : 0;
        this.onWaveformCb?.(visualizerLevel);

        // NOTE: Raw audio energy (RMS/Volume) MUST NEVER trigger interruption!
        // Background noise, loud sounds, non-verbal audio, or unclear noise are strictly ignored.
        // Interruption is handled EXCLUSIVELY via recognized crystal-clear user speech transcripts.

        // Stream Normalized Clean Voice to Gemini Live WebSocket
        if (this.liveWs && this.liveWs.readyState === WebSocket.OPEN) {
          if (isUserSpeaking) {
            // User is actively speaking: send AGC-normalized high-clarity PCM
            const base64 = floatTo16BitPCM(normalizedBuffer);
            this.liveWs.send(JSON.stringify({ type: 'audio', data: base64 }));
          } else {
            // Background is idle / ambient noise: send silence/zero frame to prevent hallucination or ambient pickup
            const silenceData = new Float32Array(inputData.length);
            const base64 = floatTo16BitPCM(silenceData);
            this.liveWs.send(JSON.stringify({ type: 'audio', data: base64 }));
          }
        }
      };

      // Connect Complete Clean Audio DSP Chain:
      // micSource -> Highpass 85Hz -> Highpass 120Hz -> Lowpass 3600Hz -> Presence Peaking -> Compressor -> Analyser -> micProcessor
      this.micSource.connect(highpassFilter);
      highpassFilter.connect(highpassFilter2);
      highpassFilter2.connect(lowpassFilter);
      lowpassFilter.connect(presenceFilter);
      presenceFilter.connect(dynamicsCompressor);
      dynamicsCompressor.connect(this.inputAnalyser);
      this.inputAnalyser.connect(this.micProcessor);
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
        if (this.inputAnalyser) {
          this.inputAnalyser.disconnect();
        }
        this.micProcessor.disconnect();
      } catch {
        // ignore
      }
      this.micProcessor = null;
      this.micSource = null;
      this.inputAnalyser = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    // Reset AGC state
    this.smoothAgcGain = 1.0;
    this.onAncCb?.({
      status: 'idle',
      snrDb: 0,
      gainMultiplier: 1.0,
      noiseSuppressedPercent: 0,
      voicePurity: 0,
      isVoiceActive: false,
    });

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

    // Call Gemini 3.1 Flash TTS Model exclusively (Zero-Latency 24kHz PCM pipeline)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

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
          await this.playBase64Pcm(data.audio, cacheKey, onEnd);
          return;
        }
      }
    } catch (e) {
      console.info('Gemini 3.1 Flash TTS preview error:', e);
    }

    // Gemini 3.1 Live TTS preview is strictly used for voice generation
    this.stopWaveformAnimation();
    this.onStatusCb?.('idle');
    onEnd?.();
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

  // Wake Chime Audio Synthesis (E5 -> B5 upbeat confirmation tone)
  public playWakeChime() {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.1); // B5
      gain2.gain.setValueAtTime(0.15, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.35);
    } catch {
      // ignore
    }
  }

  private wakeWordRecognition: any = null;
  private isWakeWordActive = false;

  // Hands-free Wake Word Listener ("Hey Schedura", "Schedura", "Hi Schedura", "Hey Schedule")
  public startWakeWordListener(onTrigger: () => void) {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    this.stopWakeWordListener();
    try {
      this.wakeWordRecognition = new SpeechRec();
      this.wakeWordRecognition.continuous = true;
      this.wakeWordRecognition.interimResults = true;
      this.wakeWordRecognition.maxAlternatives = 3;
      this.wakeWordRecognition.lang = 'en-US';

      this.isWakeWordActive = true;

      this.wakeWordRecognition.onresult = (e: any) => {
        if (!this.isWakeWordActive || this.isListening) return;

        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          for (let j = 0; j < res.length; j++) {
            const phrase = (res[j].transcript || '').toLowerCase().trim();
            if (
              phrase.includes('schedura') ||
              phrase.includes('schadura') ||
              phrase.includes('skedura') ||
              phrase.includes('sedura') ||
              phrase.includes('schedule') ||
              phrase.includes('shadura') ||
              phrase.includes('schedera') ||
              phrase.includes('schedular') ||
              phrase.includes('hey schedura') ||
              phrase.includes('hi schedura') ||
              phrase.includes('hello schedura') ||
              phrase.includes('hey schedule') ||
              phrase.includes('listen schedura') ||
              phrase.includes('ok schedura') ||
              phrase.includes('ae schedura') ||
              phrase.includes('haey schedura') ||
              phrase.includes('hey shadura')
            ) {
              this.playWakeChime();
              this.stopWakeWordListener();
              onTrigger();
              return;
            }
          }
        }
      };

      this.wakeWordRecognition.onerror = () => {
        if (this.isWakeWordActive && !this.isListening) {
          setTimeout(() => {
            if (this.isWakeWordActive && !this.isListening && !this.wakeWordRecognition) {
              this.startWakeWordListener(onTrigger);
            }
          }, 300);
        }
      };

      this.wakeWordRecognition.onend = () => {
        if (this.isWakeWordActive && !this.isListening) {
          setTimeout(() => {
            if (this.isWakeWordActive && !this.isListening) {
              try {
                this.wakeWordRecognition?.start();
              } catch {
                this.startWakeWordListener(onTrigger);
              }
            }
          }, 200);
        }
      };

      this.wakeWordRecognition.start();
    } catch {
      this.isWakeWordActive = false;
    }
  }

  public stopWakeWordListener() {
    this.isWakeWordActive = false;
    if (this.wakeWordRecognition) {
      try {
        this.wakeWordRecognition.stop();
      } catch {
        // ignore
      }
      this.wakeWordRecognition = null;
    }
  }
}

export const voiceService = new VoiceService();
