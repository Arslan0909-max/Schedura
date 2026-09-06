import React, { useState } from 'react';
import { X, ShieldCheck, Volume2, Clock, Play, Globe, Sparkles, Key, Check, Moon, Sun } from 'lucide-react';
import { voiceService, GoogleVoiceName } from '../services/voiceService';
import { getClientApiKey, saveClientApiKey } from '../services/clientGeminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  strictConflict: boolean;
  setStrictConflict: (val: boolean) => void;
  autoRerouteRooms: boolean;
  setAutoRerouteRooms: (val: boolean) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  strictConflict,
  setStrictConflict,
  autoRerouteRooms,
  setAutoRerouteRooms,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  if (!isOpen) return null;

  const [voice, setVoiceState] = useState<GoogleVoiceName>(voiceService.getVoice());
  const [language, setLanguageState] = useState<string>(voiceService.getLanguage());
  const [shiftHours, setShiftHours] = useState('08:30 - 14:00');
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getClientApiKey());
  const [isSavedKey, setIsSavedKey] = useState(false);

  const handleSaveApiKey = () => {
    saveClientApiKey(apiKeyInput);
    setIsSavedKey(true);
    setTimeout(() => setIsSavedKey(false), 2000);
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white/95 dark:bg-[#18191E]/95 backdrop-blur-2xl border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-5">
          <div className="flex items-center gap-2">
            <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">Schedura Engine Settings</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              Active
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Dark Mode & Appearance Setting */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                {isDarkMode ? (
                  <Moon className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
                <span>Appearance & Theme</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                isDarkMode
                  ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/50'
                  : 'bg-zinc-200/70 text-zinc-700 border border-zinc-300/60'
              }`}>
                {isDarkMode ? 'Night Mode' : 'Light Mode'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200">Dark Mode</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Switch between crisp light theme and eye-friendly dark obsidian aesthetic
                </div>
              </div>

              {/* Dark Mode Interactive Switch Toggle */}
              <button
                type="button"
                id="toggle-dark-mode"
                role="switch"
                aria-checked={isDarkMode}
                onClick={onToggleDarkMode}
                className={`w-12 h-6.5 rounded-full transition-colors relative flex items-center px-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer ${
                  isDarkMode ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                <div
                  className={`w-5.5 h-5.5 rounded-full bg-white shadow-sm flex items-center justify-center transition-transform duration-200 ${
                    isDarkMode ? 'translate-x-5.5' : 'translate-x-0'
                  }`}
                >
                  {isDarkMode ? (
                    <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
              </button>
            </div>

            {/* Segmented Quick Switcher */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                id="btn-select-light-theme"
                onClick={() => {
                  if (isDarkMode && onToggleDarkMode) onToggleDarkMode();
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-[12px] font-medium transition-all cursor-pointer ${
                  !isDarkMode
                    ? 'bg-white border-zinc-800 text-zinc-900 font-semibold shadow-xs ring-2 ring-zinc-800/10'
                    : 'bg-white/40 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light Theme</span>
              </button>

              <button
                type="button"
                id="btn-select-dark-theme"
                onClick={() => {
                  if (!isDarkMode && onToggleDarkMode) onToggleDarkMode();
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-[12px] font-medium transition-all cursor-pointer ${
                  isDarkMode
                    ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200 font-semibold shadow-xs ring-2 ring-indigo-500/30'
                    : 'bg-white/40 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dark Theme</span>
              </button>
            </div>
          </div>

          {/* Gemini API Key Configuration for Client-side / Static Hosting */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Google Gemini API Key (Free Hosted Client)</span>
              </div>
              {isSavedKey && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" /> Saved!
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-zinc-600 dark:text-zinc-400">
              Enter your free Google Gemini API Key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 underline font-medium"
              >
                aistudio.google.com
              </a>{' '}
              to run AI chat & timetable generation directly on Netlify / GitHub Pages.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AQ.Ab8RN... or AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12.5px] text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-semibold transition-all shadow-xs cursor-pointer"
              >
                Save Key
              </button>
            </div>
          </div>

          {/* Google AI Voice Engine Setting */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Google AI High-Fidelity Voice Model</span>
              </div>
              <button
                type="button"
                onClick={handleTestVoice}
                disabled={isPlayingTest}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isPlayingTest ? 'Playing...' : 'Test Voice'}</span>
              </button>
            </div>
            <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
              Powered by Google AI's voice synthesis with zero-latency streaming, human emotional inflection, and native multilingual support.
            </p>

            {/* Voice Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {googleVoices.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSelectVoice(v.id)}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                    voice === v.id
                      ? 'bg-black dark:bg-indigo-600 text-white border-black dark:border-indigo-500 shadow-xs ring-2 ring-black/10 dark:ring-indigo-500/20'
                      : 'bg-white dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold">{v.name}</span>
                    {voice === v.id && <Sparkles className="w-3 h-3 text-amber-300" />}
                  </div>
                  <span
                    className={`block text-[10.5px] mt-0.5 ${
                      voice === v.id ? 'text-zinc-300' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {v.style}
                  </span>
                </button>
              ))}
            </div>

            {/* Language Selection */}
            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-750 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-700 dark:text-zinc-300 shrink-0">
                <Globe className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>Language & Accent</span>
              </div>
              <select
                value={language}
                onChange={(e) => handleSelectLanguage(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12px] text-zinc-800 dark:text-zinc-200 focus:outline-none max-w-[220px]"
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
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60 space-y-3">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Conflict Prevention Engine (The Brain)</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200">Strict Anti-Clash Rule</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Block double-booking teacher or room across all semesters
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStrictConflict(!strictConflict)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  strictConflict ? 'bg-black dark:bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    strictConflict ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
              <div>
                <div className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200">Auto-Reroute Free Rooms</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  When a room clashes, automatically assign next available room (e.g. R-12 to R-16)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoRerouteRooms(!autoRerouteRooms)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  autoRerouteRooms ? 'bg-black dark:bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'
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
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60 space-y-2">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">
              <Clock className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>Standard Morning Shift Duration</span>
            </div>
            <select
              value={shiftHours}
              onChange={(e) => setShiftHours(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="08:30 - 14:00">08:30 AM – 02:00 PM (Standard 6 Slots)</option>
              <option value="09:00 - 15:00">09:00 AM – 03:00 PM (Extended Shift)</option>
              <option value="08:00 - 13:30">08:00 AM – 01:30 PM (Early Shift)</option>
            </select>
          </div>
        </div>

        <div className="pt-5 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-[13px] font-medium transition-transform active:scale-95 cursor-pointer"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

