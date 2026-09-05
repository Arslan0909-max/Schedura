import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  Globe,
  Lightbulb,
  Mic,
  Send,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  CalendarCheck2,
  Volume2,
  VolumeX,
  RefreshCw,
  Zap,
  Radio,
  Check,
} from 'lucide-react';
import { ChatMessage, TimetableData } from '../types/timetable';
import { voiceService, GoogleVoiceName } from '../services/voiceService';

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isVoiceProcessing?: boolean;
  onSendMessage: (text: string, isVoice?: boolean) => void;
  onRenderToCanvas: (data: Partial<TimetableData>) => void;
  activeTimetable: TimetableData | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  isVoiceProcessing = false,
  onSendMessage,
  onRenderToCanvas,
  activeTimetable,
}) => {
  const [inputText, setInputText] = useState('');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'fetching' | 'speaking' | 'error'>('idle');
  const [waveformLevel, setWaveformLevel] = useState<number>(0);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [showHelperMenu, setShowHelperMenu] = useState(false);
  const [showAssistantDropdown, setShowAssistantDropdown] = useState(false);
  const [assistantMode, setAssistantMode] = useState<'Standard' | 'Strict Clash Prevention' | 'Speed Schedule'>('Standard');
  const [selectedVoice, setSelectedVoice] = useState<GoogleVoiceName>(voiceService.getVoice());
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isVoiceProcessing]);

  // Connect waveform listener from voiceService
  useEffect(() => {
    voiceService.setWaveformCallback((level) => {
      setWaveformLevel(level);
    });
    return () => {
      voiceService.setWaveformCallback(null);
    };
  }, []);

  // Voice Mode Toggle with Gemini 3.1 Flash Live Preview
  const toggleVoiceMode = async () => {
    if (isVoiceActive) {
      voiceService.stopLiveVoiceMode();
      setIsVoiceActive(false);
      setVoiceStatus('idle');
      setLiveTranscript('');
    } else {
      setIsVoiceActive(true);
      setVoiceStatus('listening');
      setLiveTranscript('');
      const started = await voiceService.startLiveVoiceMode(
        (transcript, isFinal) => {
          setInputText(transcript);
          setLiveTranscript(transcript);
          if (isFinal && transcript.trim().length > 2) {
            onSendMessage(transcript.trim(), true);
            setInputText('');
          }
        },
        (status) => {
          setVoiceStatus(status);
        },
        (timetableData) => {
          if (timetableData) {
            onRenderToCanvas(timetableData);
          }
        }
      );
      if (!started) {
        setIsVoiceActive(false);
        setVoiceStatus('idle');
        setLiveTranscript('');
      }
    }
  };

  const handleSpeak = (id: string, text: string) => {
    if (speakingMessageId === id) {
      voiceService.stopSpeaking();
      setSpeakingMessageId(null);
    } else {
      setSpeakingMessageId(id);
      voiceService.speakText(text, () => {
        setSpeakingMessageId(null);
      });
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    onSendMessage(text);
  };

  const quickPrompts = [
    'BBA Semester 1 Section A & B timetable',
    'Morning Shift 8:30 AM to 2:00 PM with Break',
    'Add Dr. Tariq Khan for Financial Accounting in R-11',
    'Assign Prof. Sarah Ahmed for Math in R-13',
  ];

  return (
    <section
      id="schedura-chat-panel"
      className="w-full h-full liquid-glass border-r border-zinc-200/60 flex flex-col justify-between relative overflow-hidden transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.03)]"
    >
      {/* Header matching Apple translucent design */}
      <header className="h-14 border-b border-zinc-200/60 px-4 sm:px-5 flex items-center justify-between liquid-glass-subtle shrink-0 z-10">
        <div className="relative">
          <button
            id="ai-assistant-dropdown"
            onClick={() => setShowAssistantDropdown(!showAssistantDropdown)}
            className="flex items-center gap-1.5 text-[15px] font-semibold text-zinc-900 hover:text-zinc-600 punch-tap transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Assistant</span>
            <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform duration-150" />
          </button>

          {showAssistantDropdown && (
            <div className="absolute top-9 left-0 w-60 p-1.5 liquid-glass-card rounded-2xl shadow-2xl border border-zinc-200/80 z-50 text-[13px] animate-soft-punch">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Assistant Mode
              </div>
              {(['Standard', 'Strict Clash Prevention', 'Speed Schedule'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setAssistantMode(mode);
                    setShowAssistantDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between punch-tap ${
                    assistantMode === mode ? 'bg-zinc-900 font-semibold text-white shadow-xs' : 'text-zinc-700 hover:bg-zinc-100/80'
                  }`}
                >
                  <span>{mode}</span>
                  {assistantMode === mode && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Schedura Status Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100/80 border border-zinc-200/60 text-[11px] font-medium text-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-zinc-800">Schedura AI</span>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div
        id="schedura-chat-messages-container"
        className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-5 py-3 sm:py-4 space-y-3.5 sm:space-y-4 scroll-smooth"
      >
        {messages.length === 0 ? (
          /* Clean empty state with cute Schedura Logo */
          <div className="h-full flex flex-col justify-center items-center text-center px-2 sm:px-4 max-w-sm mx-auto select-none animate-in fade-in duration-300">
            {/* Cute Schedura Brand Logo */}
            <div className="relative mb-3.5 soft-bounce group cursor-default">
              <div className="w-13.5 h-13.5 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 p-[1.5px] shadow-lg shadow-indigo-500/15">
                <div className="w-full h-full bg-white rounded-[14.5px] flex items-center justify-center transition-transform group-hover:scale-105 duration-200">
                  <div className="relative flex items-center justify-center">
                    <CalendarCheck2 className="w-6.5 h-6.5 sm:w-7 sm:h-7 text-indigo-600 stroke-[2.2]" />
                  </div>
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white shadow-xs">
                <Zap className="w-2.5 h-2.5 text-white fill-white" />
              </span>
            </div>
            <h2 className="text-[16px] sm:text-[17px] font-semibold text-zinc-900 tracking-tight mb-1">
              Schedura Timetable AI
            </h2>
            <p className="text-[12.5px] sm:text-[13px] text-zinc-500 leading-relaxed mb-5 sm:mb-6">
              Your conversational timetable orchestrator. Speak or type your courses, professors, and rooms—I'll render conflict-free schedules in real time.
            </p>

            {/* Quick Starters */}
            <div className="w-full space-y-2 text-left">
              <div className="text-[10px] sm:text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
                Suggested Starters
              </div>
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(prompt)}
                  className="w-full text-left px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl liquid-glass-card text-[12px] sm:text-[12.5px] text-zinc-700 hover:border-zinc-400 hover:shadow-xs transition-all duration-150 punch-tap flex items-center justify-between group"
                >
                  <span className="truncate pr-2">{prompt}</span>
                  <Send className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
            >
              {msg.role === 'user' ? (
                /* User Message */
                <div className="max-w-[88%] sm:max-w-[82%] md:max-w-[78%] px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl rounded-br-sm bg-zinc-900 text-white text-[13px] sm:text-[13.5px] leading-relaxed shadow-sm punch-tap break-words">
                  {msg.content}
                </div>
              ) : (
                /* Assistant Message */
                <div className="max-w-[94%] sm:max-w-[90%] md:max-w-[86%] space-y-2">
                  <div className="p-3.5 sm:p-4 rounded-2xl rounded-tl-sm liquid-glass-card shadow-xs text-[13px] sm:text-[13.5px] text-zinc-800 leading-relaxed relative group break-words">
                    {/* Message Content with bold parsing */}
                    <div className="whitespace-pre-line">
                      {msg.content.split('\n').map((line, lIdx) => {
                        // Formatting bold highlights
                        const parts = line.split(/(\*\*.*?\*\*)/g);
                        return (
                          <p key={lIdx} className={line.startsWith('- ') ? 'ml-2 my-0.5' : 'my-1'}>
                            {parts.map((p, pIdx) => {
                              if (p.startsWith('**') && p.endsWith('**')) {
                                return (
                                  <strong key={pIdx} className="font-semibold text-zinc-950">
                                    {p.slice(2, -2)}
                                  </strong>
                                );
                              }
                              return p;
                            })}
                          </p>
                        );
                      })}
                    </div>

                    {/* Quick TTS button */}
                    <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="text-zinc-500 font-medium">
                        Schedura Assistant
                      </span>
                      <button
                        onClick={() => handleSpeak(msg.id, msg.content)}
                        className={`relative flex items-center gap-1.5 transition-all px-2 py-0.5 rounded-md punch-tap ${
                          speakingMessageId === msg.id
                            ? 'bg-rose-50 text-rose-600 font-medium border border-rose-200'
                            : 'hover:text-zinc-900 hover:bg-zinc-100/80 text-zinc-500'
                        }`}
                        title="Voice read response"
                      >
                        {speakingMessageId === msg.id && (
                          <span
                            className="absolute -inset-0.5 rounded-md border border-rose-400/40 pointer-events-none transition-transform duration-100 ease-out"
                            style={{
                              transform: `scale(${1 + waveformLevel * 0.25})`,
                            }}
                          />
                        )}
                        {speakingMessageId === msg.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                            <span className="text-rose-500 font-medium">Stop</span>
                            <div className="flex items-center gap-0.5 h-2.5 ml-0.5">
                              <span
                                className="w-0.5 bg-rose-500 rounded-full transition-all duration-75"
                                style={{ height: `${Math.max(2, Math.min(8, Math.round(waveformLevel * 10)))}px` }}
                              />
                              <span
                                className="w-0.5 bg-rose-500 rounded-full transition-all duration-75"
                                style={{ height: `${Math.max(3, Math.min(10, Math.round(waveformLevel * 12)))}px` }}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Render to Canvas notification / Interactive Card */}
                  {msg.timetableData && (
                    <div className="p-3 rounded-xl liquid-glass-card border border-indigo-200/70 shadow-xs flex items-center justify-between punch-tap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[12.5px] font-semibold text-indigo-950 leading-none">
                            {msg.timetableData.semester} ({msg.timetableData.section})
                          </div>
                          <div className="text-[11px] text-indigo-700/80 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Live Rendered to WorkSpace</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onRenderToCanvas(msg.timetableData!)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11.5px] font-medium shadow-xs transition-transform active:scale-95 flex items-center gap-1"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>View Canvas</span>
                      </button>
                    </div>
                  )}

                  {/* Conflict Prevention Alert Card if any clash detected */}
                  {msg.conflicts && msg.conflicts.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-[12px] space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Conflict Prevention Alert ({msg.conflicts.length})</span>
                      </div>
                      {msg.conflicts.map((c, cIdx) => (
                        <p key={cIdx} className="text-[11.5px] text-amber-800 leading-snug">
                          • {c.description} <em className="text-amber-900 font-medium">({c.suggestedResolution})</em>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading Bubble & Voice Processing Animation */}
        {isLoading && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            {isVoiceProcessing || isVoiceActive ? (
              /* High-fidelity Voice Agent Processing Animation */
              <div
                id="voice-agent-processing-indicator"
                className="p-4 rounded-2xl bg-gradient-to-b from-white/95 to-zinc-50/90 border border-indigo-200/80 shadow-[0_8px_30px_rgb(99,102,241,0.12)] backdrop-blur-xl relative overflow-hidden"
              >
                {/* Subtle scanning glow line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-pulse" />

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30">
                      <Mic className="w-4 h-4 animate-pulse" />
                      <span className="absolute -inset-1 rounded-full border border-indigo-400/60 animate-ping opacity-75" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[13px] font-semibold text-zinc-900 tracking-tight">
                          Voice Agent Synthesizing Schedule
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Active
                        </span>
                      </div>
                      <p className="text-[11.5px] text-zinc-500">
                        Fetching conflict-free timetable and preparing WorkSpace canvas...
                      </p>
                    </div>
                  </div>

                  {/* Dancing soundwave bars */}
                  <div className="flex items-center gap-1 h-5 px-2">
                    <span className="w-1 bg-indigo-600 rounded-full h-2.5 animate-bounce" />
                    <span className="w-1 bg-indigo-600 rounded-full h-5 animate-bounce delay-100" />
                    <span className="w-1 bg-indigo-600 rounded-full h-3 animate-bounce delay-75" />
                    <span className="w-1 bg-indigo-600 rounded-full h-4.5 animate-bounce delay-150" />
                    <span className="w-1 bg-indigo-600 rounded-full h-2 animate-bounce delay-200" />
                  </div>
                </div>

                {/* Processing Steps Checklist */}
                <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-zinc-100 text-[11.5px]">
                  <div className="flex items-center gap-2 text-zinc-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Transcribed voice request & detected course sections</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Conflict Prevention Engine: Cross-referencing rooms & teachers</span>
                  </div>
                  <div className="flex items-center gap-2 text-indigo-700 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
                    <span>Rendering conflict-free grid onto WorkSpace canvas...</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Standard loading state */
              <div className="px-4 py-3 rounded-2xl bg-white/90 border border-zinc-200 text-zinc-600 text-[12.5px] flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                  <span>Schedura is checking global conflicts & generating timetable...</span>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">Working</span>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Input Bar */}
      <div className="p-2.5 sm:p-3 md:p-3.5 bg-white/70 backdrop-blur-md border-t border-zinc-200/60 shrink-0">
        <form
          id="chat-input-form"
          onSubmit={handleSubmit}
          className="bg-white hover:border-zinc-300 focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-black/5 border border-zinc-200/90 rounded-2xl p-2 sm:p-2.5 transition-all shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col gap-1.5 sm:gap-2 relative"
        >
          {/* Top text input row */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              id="chat-input-field"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isVoiceActive ? 'Listening to voice...' : 'Ask anything about timetables or command schedule...'}
              className="flex-1 bg-transparent text-[13px] sm:text-[13.5px] text-zinc-900 placeholder-zinc-400 focus:outline-none px-1"
            />

            {inputText.trim().length > 0 && (
              <button
                type="submit"
                id="btn-send-message"
                className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-black text-white flex items-center justify-center hover:bg-zinc-800 transition-colors active:scale-95 shrink-0 punch-tap"
                title="Send Message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bottom control bar with Quick Add, Voice Selector, and Live Voice Button */}
          <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[12px] gap-2 flex-wrap sm:flex-nowrap">
            {/* Left: Quick Prompts Dropdown */}
            <div className="relative">
              <button
                type="button"
                id="btn-quick-helper"
                onClick={() => setShowHelperMenu(!showHelperMenu)}
                className="h-7.5 px-2 sm:px-2.5 rounded-lg flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors font-medium text-[11px] sm:text-[11.5px] punch-tap"
                title="Quick schedule commands"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-500" />
                <span>Quick Prompt</span>
              </button>

              {showHelperMenu && (
                <div className="absolute bottom-[calc(100%+8px)] left-0 w-64 max-w-[calc(100vw-40px)] p-1.5 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-zinc-200/80 z-50 text-[12px] animate-soft-punch space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Quick Insertion
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText('Insert a university-wide lunch and prayer break daily from 11:30 to 12:00');
                      setShowHelperMenu(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors flex items-center gap-2 punch-tap"
                  >
                    <span>☕</span>
                    <span>Add Lunch / Prayer Break</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText('Generate a conflict-free schedule for BBA Semester 1 Section A with 5 courses');
                      setShowHelperMenu(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors flex items-center gap-2 punch-tap"
                  >
                    <span>📊</span>
                    <span>Auto-Generate BBA Sem 1</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText('Check all room allocations and verify zero teacher clashes across morning shift');
                      setShowHelperMenu(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors flex items-center gap-2 punch-tap"
                  >
                    <span>🛡️</span>
                    <span>Verify Zero Conflicts</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText('Assign Lab 2 for CS Practical sessions and avoid Friday afternoon');
                      setShowHelperMenu(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors flex items-center gap-2 punch-tap"
                  >
                    <span>🔬</span>
                    <span>Assign Specific Room & Lab</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right: Voice selector & Live Voice Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Quick Voice Selector Menu Trigger */}
              <div className="relative">
                <button
                  type="button"
                  id="btn-voice-selector"
                  onClick={() => setShowVoiceMenu(!showVoiceMenu)}
                  className={`h-7.5 px-2 sm:px-2.5 rounded-lg flex items-center gap-1 sm:gap-1.5 text-[11px] font-medium border punch-tap transition-all ${
                    isVoiceActive
                      ? 'bg-zinc-900 border-emerald-500/40 text-emerald-400'
                      : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200/80 text-zinc-700'
                  }`}
                  title="Select AI Voice"
                >
                  <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span className="hidden sm:inline">{selectedVoice}</span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-60 shrink-0" />
                </button>

                {showVoiceMenu && (
                  <div className="absolute bottom-[calc(100%+8px)] right-0 w-60 max-w-[calc(100vw-40px)] p-2 liquid-glass-card rounded-2xl shadow-2xl border border-zinc-200/80 z-50 text-[12px] animate-soft-punch">
                    <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Schedura Voices</span>
                      <Radio className="w-3 h-3 text-emerald-500" />
                    </div>
                    <div className="space-y-1 mt-1 max-h-60 overflow-y-auto">
                      {(
                        [
                          { id: 'Aoede', label: 'Aoede', gender: 'Female', desc: 'Warm & Expressive' },
                          { id: 'Kore', label: 'Kore', gender: 'Female', desc: 'Natural & Balanced' },
                          { id: 'Fenrir', label: 'Fenrir', gender: 'Male', desc: 'Authoritative & Deep' },
                          { id: 'Zephyr', label: 'Zephyr', gender: 'Male', desc: 'Calm & Articulate' },
                          { id: 'Puck', label: 'Puck', gender: 'Male', desc: 'Dynamic & Upbeat' },
                          { id: 'Charon', label: 'Charon', gender: 'Male', desc: 'Gentle & Academic' },
                        ] as const
                      ).map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedVoice(v.id);
                            voiceService.setVoice(v.id);
                            setShowVoiceMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl punch-tap transition-all ${
                            selectedVoice === v.id
                              ? 'bg-black text-white font-medium shadow-xs'
                              : 'text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] font-semibold">{v.label}</span>
                              <span
                                className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium ${
                                  selectedVoice === v.id
                                    ? 'bg-zinc-800 text-zinc-200'
                                    : 'bg-zinc-100 text-zinc-600'
                                }`}
                              >
                                {v.gender}
                              </span>
                            </div>
                            <div className={`text-[10px] ${selectedVoice === v.id ? 'text-zinc-300' : 'text-zinc-400'}`}>
                              {v.desc}
                            </div>
                          </div>
                          {selectedVoice === v.id && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* High-Fidelity Voice Mode / Speak Button with Soft Bouncy & Organic Wave Aura */}
              <div className="relative isolate flex items-center justify-center">
                {isVoiceActive && (
                  <>
                    {/* Organic Outer Fluid Aura - dynamically animated when speaking or listening */}
                    <span
                      className={`absolute rounded-full pointer-events-none transition-all duration-200 ease-out -z-10 ${
                        voiceStatus === 'speaking'
                          ? 'bg-gradient-to-r from-violet-500/25 via-indigo-500/25 to-pink-500/25 animate-speaking-aura'
                          : 'bg-gradient-to-r from-emerald-500/25 via-teal-500/25 to-cyan-500/25 animate-listening-aura'
                      }`}
                      style={{
                        inset: `-${Math.round(4 + waveformLevel * 12)}px`,
                        transform: `scale(${1 + waveformLevel * 0.35})`,
                        opacity: Math.max(0.3, Math.min(0.9, waveformLevel * 1.2 + 0.3)),
                        filter: 'blur(5px)',
                      }}
                    />
                    {/* Inner Pulsing Harmonic Halo */}
                    <span
                      className={`absolute -inset-1 rounded-full border pointer-events-none transition-transform duration-150 ease-out -z-10 ${
                        voiceStatus === 'speaking'
                          ? 'border-indigo-400/60 bg-indigo-500/10'
                          : 'border-emerald-400/60 bg-emerald-500/10'
                      }`}
                      style={{
                        transform: `scale(${1 + waveformLevel * 0.22})`,
                        opacity: Math.max(0.4, waveformLevel + 0.3),
                      }}
                    />
                  </>
                )}
                <button
                  type="button"
                  id="btn-voice-toggle"
                  onClick={toggleVoiceMode}
                  className={`relative z-10 h-7.5 sm:h-8 px-3 sm:px-3.5 rounded-full flex items-center gap-1.5 transition-all duration-200 punch-tap soft-bounce shrink-0 ${
                    isVoiceActive
                      ? voiceStatus === 'speaking'
                        ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 text-white shadow-[0_0_24px_rgba(99,102,241,0.5)] ring-2 ring-indigo-300/90'
                        : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-[0_0_24px_rgba(16,185,129,0.5)] ring-2 ring-emerald-300/90'
                      : 'bg-zinc-900 text-white hover:bg-black hover:shadow-md'
                  }`}
                  title={isVoiceActive ? 'Stop Live Voice Mode' : 'Start Schedura Voice Assistant'}
                >
                  <Mic className={`w-3.5 h-3.5 ${isVoiceActive ? 'animate-pulse' : ''}`} />
                  <div className="flex items-center gap-0.5 h-3.5 px-0.5">
                    {isVoiceActive ? (
                      <>
                        <span
                          className="w-0.5 bg-white rounded-full transition-all duration-100 ease-out"
                          style={{ height: `${Math.max(3, Math.min(14, Math.round(waveformLevel * 14 + 3)))}px` }}
                        />
                        <span
                          className="w-0.5 bg-white rounded-full transition-all duration-100 ease-out"
                          style={{ height: `${Math.max(4, Math.min(16, Math.round(waveformLevel * 18 + 4)))}px` }}
                        />
                        <span
                          className="w-0.5 bg-white rounded-full transition-all duration-100 ease-out"
                          style={{ height: `${Math.max(5, Math.min(18, Math.round(waveformLevel * 20 + 5)))}px` }}
                        />
                        <span
                          className="w-0.5 bg-white rounded-full transition-all duration-100 ease-out"
                          style={{ height: `${Math.max(4, Math.min(15, Math.round(waveformLevel * 16 + 4)))}px` }}
                        />
                        <span
                          className="w-0.5 bg-white rounded-full transition-all duration-100 ease-out"
                          style={{ height: `${Math.max(3, Math.min(12, Math.round(waveformLevel * 12 + 3)))}px` }}
                        />
                      </>
                    ) : (
                      <>
                        <span className="w-0.5 h-1.5 bg-white/70 rounded-full" />
                        <span className="w-0.5 h-2.5 bg-white rounded-full" />
                        <span className="w-0.5 h-1.5 bg-white/70 rounded-full" />
                      </>
                    )}
                  </div>
                  <span className="text-[11px] sm:text-[11.5px] font-medium hidden xs:inline sm:inline">
                    {isVoiceActive ? (voiceStatus === 'speaking' ? 'Speaking...' : 'Listening...') : 'Live Voice'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};
