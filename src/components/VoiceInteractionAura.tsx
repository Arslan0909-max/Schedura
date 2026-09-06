import React from 'react';
import { Sparkles, Mic, Volume2, Loader2, Zap } from 'lucide-react';

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
  // Determine current active AI Voice state
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
      badgeBg: 'bg-purple-500/15 dark:bg-purple-500/20 border-purple-500/40 text-purple-700 dark:text-purple-300 shadow-[0_0_24px_rgba(168,85,247,0.45)]',
      glowGradient: 'from-purple-500/30 via-pink-500/20 to-indigo-500/30',
      icon: <Zap className="w-3.5 h-3.5 text-purple-500 animate-bounce" />,
      label: 'Activating Schedura AI...',
    },
    listening: {
      auraClass: 'animate-listening-aura',
      badgeBg: 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.45)]',
      glowGradient: 'from-emerald-500/30 via-teal-500/20 to-cyan-500/30',
      icon: <Mic className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />,
      label: 'Listening for Speech...',
    },
    thinking: {
      auraClass: 'animate-thinking-orbit',
      badgeBg: 'bg-fuchsia-500/15 dark:bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-700 dark:text-fuchsia-300 shadow-[0_0_28px_rgba(217,70,239,0.5)]',
      glowGradient: 'from-violet-500/30 via-fuchsia-500/25 to-amber-500/30',
      icon: <Loader2 className="w-3.5 h-3.5 text-fuchsia-500 animate-spin" />,
      label: 'Architecting Schedule...',
    },
    speaking: {
      auraClass: 'animate-speaking-aura',
      badgeBg: 'bg-indigo-500/15 dark:bg-indigo-500/20 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-[0_0_28px_rgba(99,102,241,0.5)]',
      glowGradient: 'from-indigo-500/30 via-violet-500/25 to-pink-500/30',
      icon: <Volume2 className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />,
      label: 'Speaking Response...',
    },
    idle: {
      auraClass: '',
      badgeBg: 'bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-200/60 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-200',
      glowGradient: 'from-transparent to-transparent',
      icon: <Sparkles className="w-3.5 h-3.5 text-emerald-500" />,
      label: 'Schedura Voice Ready',
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
        className={`relative flex items-center gap-1.5 rounded-full border font-medium transition-all duration-500 ${sizeClasses} ${stateConfig.badgeBg}`}
      >
        {stateConfig.icon}
        {showLabel && <span className="font-semibold tracking-tight">{stateConfig.label}</span>}
      </div>
    </div>
  );
};
