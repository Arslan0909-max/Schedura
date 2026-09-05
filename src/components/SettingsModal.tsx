import React, { useState } from 'react';
import { X, ShieldCheck, Volume2, Clock, Play, Globe, Sparkles } from 'lucide-react';
import { voiceService, GoogleVoiceName } from '../services/voiceService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  strictConflict: boolean;
  setStrictConflict: (val: boolean) => void;
  autoRerouteRooms: boolean;
  setAutoRerouteRooms: (val: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  strictConflict,
  setStrictConflict,
  autoRerouteRooms,
  setAutoRerouteRooms,
}) => {
  if (!isOpen) return null;

  const [voice, setVoiceState] = useState<GoogleVoiceName>(voiceService.getVoice());
  const [language, setLanguageState] = useState<string>(voiceService.getLanguage());
  const [shiftHours, setShiftHours] = useState('08:30 - 14:00');
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  const googleVoices: { id: GoogleVoiceName; name: string; style: string }[] = [
    { id: 'Aoede', name: 'Aoede', style: 'Warm & Expressive' },
    { id: 'Zephyr', name: 'Zephyr', style: 'Calm & Articulate' },
    { id: 'Puck', name: 'Puck', style: 'Dynamic & Upbeat' },
    { id: 'Kore', name: 'Kore', style: 'Natural & Balanced' },
    { id: 'Fenrir', name: 'Fenrir', style: 'Authoritative & Crisp' },
    { id: 'Charon', name: 'Charon', style: 'Gentle & Academic' },
  ];

  const languages = [
    { code: 'auto', label: 'Auto-Detect (Multilingual)' },
    { code: 'en-US', label: 'English (United States)' },
    { code: 'es-ES', label: 'Spanish (Español)' },
    { code: 'ur-PK', label: 'Urdu (اردو)' },
    { code: 'hi-IN', label: 'Hindi (हिंदी)' },
    { code: 'fr-FR', label: 'French (Français)' },
    { code: 'de-DE', label: 'German (Deutsch)' },
    { code: 'ar-SA', label: 'Arabic (العربية)' },
  ];

  const handleSelectVoice = (v: GoogleVoiceName) => {
    setVoiceState(v);
    voiceService.setVoice(v);
  };

  const handleSelectLanguage = (lang: string) => {
    setLanguageState(lang);
    voiceService.setLanguage(lang);
  };

  const handleTestVoice = () => {
    setIsPlayingTest(true);
    voiceService.speakText(
      `Hello! I am Schedura's voice assistant, powered by Google's high-fidelity voice model with zero latency. How can I help organize your timetable today?`,
      () => {
        setIsPlayingTest(false);
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl border border-zinc-200/80 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-5">
          <div className="flex items-center gap-2">
            <h3 className="text-[17px] font-semibold text-zinc-900">Schedura Engine Settings</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              Active
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Google AI Voice Engine Setting */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-zinc-900">
                <Volume2 className="w-4 h-4 text-indigo-600" />
                <span>Google AI High-Fidelity Voice Model</span>
              </div>
              <button
                type="button"
                onClick={handleTestVoice}
                disabled={isPlayingTest}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium transition-all shadow-xs disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isPlayingTest ? 'Playing...' : 'Test Voice'}</span>
              </button>
            </div>
            <p className="text-[11.5px] text-zinc-500">
              Powered by Google AI's voice synthesis with zero-latency streaming, human emotional inflection, and native multilingual support.
            </p>

            {/* Voice Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {googleVoices.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSelectVoice(v.id)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    voice === v.id
                      ? 'bg-black text-white border-black shadow-xs ring-2 ring-black/10'
                      : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold">{v.name}</span>
                    {voice === v.id && <Sparkles className="w-3 h-3 text-amber-300" />}
                  </div>
                  <span
                    className={`block text-[10.5px] mt-0.5 ${
                      voice === v.id ? 'text-zinc-300' : 'text-zinc-400'
                    }`}
                  >
                    {v.style}
                  </span>
                </button>
              ))}
            </div>

            {/* Language Selection */}
            <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-700 shrink-0">
                <Globe className="w-3.5 h-3.5 text-zinc-500" />
                <span>Language & Accent</span>
              </div>
              <select
                value={language}
                onChange={(e) => handleSelectLanguage(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-white text-[12px] text-zinc-800 focus:outline-none max-w-[220px]"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conflict Prevention Engine */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-3">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-zinc-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Conflict Prevention Engine (The Brain)</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-zinc-800">Strict Anti-Clash Rule</div>
                <div className="text-[11px] text-zinc-500">
                  Block double-booking teacher or room across all semesters
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStrictConflict(!strictConflict)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  strictConflict ? 'bg-black' : 'bg-zinc-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    strictConflict ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60">
              <div>
                <div className="text-[13px] font-medium text-zinc-800">Auto-Reroute Free Rooms</div>
                <div className="text-[11px] text-zinc-500">
                  When a room clashes, automatically assign next available room (e.g. R-12 to R-16)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoRerouteRooms(!autoRerouteRooms)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  autoRerouteRooms ? 'bg-black' : 'bg-zinc-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    autoRerouteRooms ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Shift defaults */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-2">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-zinc-900">
              <Clock className="w-4 h-4 text-zinc-700" />
              <span>Standard Morning Shift Duration</span>
            </div>
            <select
              value={shiftHours}
              onChange={(e) => setShiftHours(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-[13px] text-zinc-800 focus:outline-none"
            >
              <option value="08:30 - 14:00">08:30 AM – 02:00 PM (Standard 6 Slots)</option>
              <option value="09:00 - 15:00">09:00 AM – 03:00 PM (Extended Shift)</option>
              <option value="08:00 - 13:30">08:00 AM – 01:30 PM (Early Shift)</option>
            </select>
          </div>
        </div>

        <div className="pt-5 mt-4 border-t border-zinc-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-black hover:bg-zinc-800 text-white text-[13px] font-medium transition-transform active:scale-95"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
