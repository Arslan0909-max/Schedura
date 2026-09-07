import { memoryService, AIKnowledgeItem } from './memoryService';

export interface UserFeedbackEvent {
  id: string;
  timestamp: number;
  type: 'thumbs_up' | 'thumbs_down' | 'correction' | 'manual_edit' | 'voice_interruption';
  userQuery?: string;
  aiResponse?: string;
  correctionText?: string;
  rewardScore: number; // +1.0 for positive, -1.0 for negative, +0.5 for edit
  contextTags: string[];
}

export interface LearnedPolicy {
  preferredShift?: 'Morning' | 'Evening';
  favoriteColors?: Record<string, string>;
  facultyTimeConstraints?: Record<string, string>;
  roomPreferences?: Record<string, string>;
  interactionStyle?: 'concise' | 'detailed' | 'partner';
  reinforcementScore: number;
  totalFeedbackEvents: number;
  lastUpdated: number;
}

const RL_STORAGE_KEY = 'schedura_rl_policy_v1';
const RL_EVENTS_KEY = 'schedura_rl_events_v1';

class LearningEngine {
  activePolicy: LearnedPolicy = {
    reinforcementScore: 100,
    totalFeedbackEvents: 0,
    lastUpdated: Date.now(),
  };

  private events: UserFeedbackEvent[] = [];

  constructor() {
    this.loadPolicy();
  }

  private loadPolicy() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(RL_STORAGE_KEY);
      if (saved) {
        this.activePolicy = JSON.parse(saved);
      }
      const savedEvents = localStorage.getItem(RL_EVENTS_KEY);
      if (savedEvents) {
        this.events = JSON.parse(savedEvents);
      }
    } catch {
      // ignore
    }
  }

  private savePolicy() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(RL_STORAGE_KEY, JSON.stringify(this.activePolicy));
      localStorage.setItem(RL_EVENTS_KEY, JSON.stringify(this.events.slice(-50))); // keep last 50
    } catch {
      // ignore
    }
  }

  /**
   * Record a user feedback event and run reinforcement learning updates
   */
  public recordFeedback(event: Omit<UserFeedbackEvent, 'id' | 'timestamp'>) {
    const fullEvent: UserFeedbackEvent = {
      ...event,
      id: `rl-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);
    this.activePolicy.totalFeedbackEvents += 1;
    this.activePolicy.reinforcementScore += event.rewardScore * 10;
    this.activePolicy.lastUpdated = Date.now();

    // Self-Improvement: If user provided correction text or explicit instruction, convert into long-term policy rule memory
    if (event.correctionText && event.correctionText.trim().length > 3) {
      memoryService.addMemory({
        title: `Learned Preference (RL Auto-Policy)`,
        content: `User Preference / Self-Improvement Policy: ${event.correctionText.trim()}`,
        category: 'rule',
        tags: ['rl_learned', 'user_preference', ...event.contextTags],
      });
    }

    this.savePolicy();
    return fullEvent;
  }

  /**
   * Analyze user timetable edits and self-improve system defaults
   */
  public learnFromTimetableEdit(originalSubject: string, newTimeSlot: string, newDay: string, teacher?: string) {
    const note = `User manually moved ${originalSubject} (${teacher || 'Faculty'}) to ${newDay} at ${newTimeSlot}. Prefer this placement in future automated schedules.`;
    
    this.recordFeedback({
      type: 'manual_edit',
      userQuery: `Moved ${originalSubject}`,
      correctionText: note,
      rewardScore: 0.5,
      contextTags: ['timetable_placement', newDay.toLowerCase()],
    });
  }

  /**
   * Generates a dynamic prompt reinforcement context snippet for Gemini
   */
  public getReinforcementPromptContext(): string {
    const recentMemories = memoryService.getMemories().filter((m) => m.tags?.includes('rl_learned'));
    
    let context = `\nREINFORCEMENT LEARNING & SELF-IMPROVEMENT POLICY:\n`;
    context += `- Total System RL Score: ${Math.round(this.activePolicy.reinforcementScore)} pts (Self-Improved from ${this.activePolicy.totalFeedbackEvents} user interactions)\n`;
    context += `- Partner Tone: Conversational, highly empathetic, partner-like, responsive, concise during routine actions.\n`;
    
    if (recentMemories.length > 0) {
      context += `- Learned User Behavior Rules:\n`;
      recentMemories.slice(-5).forEach((m) => {
        context += `  * ${m.content}\n`;
      });
    }

    return context;
  }

  public getPolicy(): LearnedPolicy {
    return this.activePolicy;
  }

  public getEvents(): UserFeedbackEvent[] {
    return this.events;
  }
}

export const learningEngine = new LearningEngine();
