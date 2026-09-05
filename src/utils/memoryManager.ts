import { BotMemory, MemoryCategory } from '../types/timetable';

const STORAGE_KEY = 'schedura_ai_memories_v1';

export const DEFAULT_INITIAL_MEMORIES: BotMemory[] = [
  {
    id: 'mem-rule-friday-break',
    category: 'rule',
    title: 'Friday Jummah & Prayer Break',
    content: 'On Fridays, always schedule prayer & lunch break between 12:30 PM - 02:00 PM without any overlapping classes.',
    enabled: true,
    source: 'user_defined',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'mem-pref-morning-labs',
    category: 'preference',
    title: 'Computer Science Lab Allocations',
    content: 'All practical lab sessions (DSA, Database, OS) must be allocated to Lab 1 or Lab 2 with 2-hour or dual slots.',
    enabled: true,
    source: 'user_defined',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mem-proj-active-semester',
    category: 'project',
    title: 'Active Project: University Spring 2026',
    content: 'Current scheduling target: Morning Shift (08:30 AM – 02:30 PM), standard 5-day week (Monday to Friday).',
    enabled: true,
    source: 'auto_learned',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mem-note-faculty-pref',
    category: 'note',
    title: 'Faculty Timing Preferences',
    content: 'Prof. Sarah Ahmed is available on Monday, Tuesday, and Thursday mornings. Dr. Tariq Khan prefers consecutive slots.',
    enabled: true,
    source: 'auto_learned',
    createdAt: new Date().toISOString(),
  },
];

export function getStoredMemories(): BotMemory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_MEMORIES));
      return DEFAULT_INITIAL_MEMORIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_INITIAL_MEMORIES;
  } catch {
    return DEFAULT_INITIAL_MEMORIES;
  }
}

export function saveStoredMemories(memories: BotMemory[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  } catch (err) {
    console.warn('Failed to save memories to localStorage:', err);
  }
}

export function formatMemoriesForPrompt(memories: BotMemory[]): string {
  const active = memories.filter((m) => m.enabled);
  if (active.length === 0) return '';

  const grouped = active.reduce((acc, mem) => {
    acc[mem.category] = acc[mem.category] || [];
    acc[mem.category].push(`- [${mem.title}]: ${mem.content}`);
    return acc;
  }, {} as Record<MemoryCategory, string[]>);

  let formatted = '\n[LONG-TERM USER MEMORY & PROJECT CONSTRAINTS]:\n';
  if (grouped.rule?.length) {
    formatted += `\n* Institutional & Scheduling Rules:\n${grouped.rule.join('\n')}\n`;
  }
  if (grouped.preference?.length) {
    formatted += `\n* User Preferences:\n${grouped.preference.join('\n')}\n`;
  }
  if (grouped.project?.length) {
    formatted += `\n* Project Context:\n${grouped.project.join('\n')}\n`;
  }
  if (grouped.note?.length) {
    formatted += `\n* Faculty & Room Notes:\n${grouped.note.join('\n')}\n`;
  }

  return formatted;
}

export function detectMemoryFromMessage(text: string): Partial<BotMemory> | null {
  const lower = text.toLowerCase();
  
  const triggers = [
    'remember that',
    'remember this',
    'keep in mind',
    'always make sure',
    'always schedule',
    'hamesha yaad rakhna',
    'yaad rakhna',
    'note that',
    'rule:',
    'constraint:',
  ];

  const matchedTrigger = triggers.find((t) => lower.includes(t));
  if (!matchedTrigger) return null;

  let category: MemoryCategory = 'note';
  if (lower.includes('rule') || lower.includes('policy') || lower.includes('must') || lower.includes('zaroori')) {
    category = 'rule';
  } else if (lower.includes('prefer') || lower.includes('like') || lower.includes('pasand')) {
    category = 'preference';
  } else if (lower.includes('semester') || lower.includes('batch') || lower.includes('project')) {
    category = 'project';
  }

  // Extract relevant sentence
  const cleanContent = text.trim();
  const title = cleanContent.length > 35 ? `${cleanContent.slice(0, 32)}...` : cleanContent;

  return {
    id: `mem-${Date.now()}`,
    category,
    title,
    content: cleanContent,
    enabled: true,
    source: 'auto_learned',
    createdAt: new Date().toISOString(),
  };
}
