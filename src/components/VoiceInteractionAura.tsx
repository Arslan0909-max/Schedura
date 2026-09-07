import React from 'react';
import { Mic, Volume2, Loader2, Radio, Activity } from 'lucide-react';

export type VoiceAuraState = 'opening' | 'listening' | 'thinking' | 'speaking' | 'idle';

interface VoiceInteractionAuraProps {
  isVoiceProcessing?: boolean;
  isLoading?: boolean;
  isVoiceActive?: boolean;
  voiceStatus?: string;
  isOpeningAnim?: boolean;
  stateOverride?: VoiceAuraState;
  size?: 'sm' | 'md' | 'lg' | 'full';
  showLabel?: boolean;
  className?: string;
}

export const VoiceInteractionAura: React.FC<VoiceInteractionAuraProps> = ({
  isVoiceProcessing = false,
  isLoading = false,
  isVoiceActive = false,
  voiceStatus = 'idle',
  isOpeningAnim = false,
  stateOverride,
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  // Determine current active Voice state
  const state: VoiceAuraState =
    stateOverride ||
    (isOpeningAnim
      ? 'opening'
      : isLoading || isVoiceProcessing || voiceStatus === 'fetching'
      ? 'thinking'
      : isVoiceActive && voiceStatus === 'speaking'
      ? 'speaking'
      : isVoiceActive
      ? 'listening'
      : 'idle');

  // Config mapping for keyframe classes and luminous styling
  const stateConfig = {
    opening: {
      auraClass: 'animate-opening-aura',
      badgeBg: 'bg-indigo-500/15 dark:bg-indigo-500/20 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-[0_0_24px_rgba(99,102,241,0.45)]',
      glowGradient: 'from-indigo-500/30 via-purple-500/20 to-blue-500/30',
      icon: <Radio className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />,
      label: 'Connecting Voice...',
    },
    listening: {
      auraClass: 'animate-listening-aura',
      badgeBg: 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.45)]',
      glowGradient: 'from-emerald-500/30 via-teal-500/20 to-cyan-500/30',
      icon: <Mic className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />,
      label: 'Listening...',
    },
    thinking: {
      auraClass: 'animate-thinking-orbit',
      badgeBg: 'bg-indigo-500/15 dark:bg-indigo-500/20 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-[0_0_28px_rgba(99,102,241,0.5)]',
      glowGradient: 'from-indigo-500/30 via-blue-500/25 to-purple-500/30',
      icon: <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />,
      label: 'Processing Schedule...',
    },
    speaking: {
      auraClass: 'animate-speaking-aura',
      badgeBg: 'bg-indigo-500/15 dark:bg-indigo-500/20 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-[0_0_28px_rgba(99,102,241,0.5)]',
      glowGradient: 'from-indigo-500/30 via-violet-500/25 to-pink-500/30',
      icon: <Volume2 className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />,
      label: 'Speaking...',
    },
    idle: {
      auraClass: '',
      badgeBg: 'apple-liquid-glass-subtle border border-zinc-200/60 dark:border-white/10 text-zinc-700 dark:text-zinc-200',
      glowGradient: 'from-transparent to-transparent',
      icon: <Activity className="w-3.5 h-3.5 text-emerald-500" />,
      label: 'Voice Ready',
    },
  }[state];

  // Size mapping
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10.5px]',
    md: 'px-2.5 py-1 text-[11.5px]',
    lg: 'px-3.5 py-1.5 text-[12.5px]',
    full: 'w-full px-4 py-2 text-[13px] justify-center',
  }[size];

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Outer Luminous Fluid Aura Halo */}
      {state !== 'idle' && (
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-r ${stateConfig.glowGradient} blur-md pointer-events-none transition-all duration-500 ease-in-out ${stateConfig.auraClass}`}
        />
      )}

      {/* Main Glass Badge */}
      <div
        className={`relative flex items-center gap-1.5 rounded-full border font-medium transition-all duration-500 backdrop-blur-2xl ${sizeClasses} ${stateConfig.badgeBg}`}
      >
        {stateConfig.icon}
        {showLabel && <span className="font-semibold tracking-tight">{stateConfig.label}</span>}
      </div>
    </div>
  );
};
