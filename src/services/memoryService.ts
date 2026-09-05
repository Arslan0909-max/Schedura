export interface AIKnowledgeItem {
  id: string;
  category: 'teacher' | 'course' | 'room' | 'rule' | 'project' | 'general';
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'schedura_ai_persistent_memory_v1';

// Default initial memories for new users
const DEFAULT_MEMORIES: AIKnowledgeItem[] = [
  {
    id: 'mem-1',
    category: 'rule',
    title: 'Friday Prayer & Lunch Break',
    content: 'Friday break must be strictly scheduled between 12:30 PM and 02:00 PM for all semesters and shifts.',
    tags: ['friday', 'break', 'prayer'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-2',
    category: 'teacher',
    title: 'Dr. Tariq Khan (DSA Faculty)',
    content: 'Dr. Tariq Khan teaches Data Structures & Algorithms and is only available for Morning shifts (08:30 AM to 12:30 PM).',
    tags: ['teacher', 'dsa', 'morning'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-3',
    category: 'room',
    title: 'Computer Science Labs',
    content: 'Lab 1 and Lab 2 have 60 high-spec PCs each, reserved primarily for BSCS practical sessions.',
    tags: ['room', 'lab', 'bscs'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

class MemoryService {
  private memories: AIKnowledgeItem[] = [];

  constructor() {
    this.loadMemories();
  }

  private loadMemories(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memories = parsed;
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to load persistent memories from localStorage:', err);
    }
    this.memories = [...DEFAULT_MEMORIES];
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memories));
    } catch (err) {
      console.warn('Failed to save memories to localStorage:', err);
    }
  }

  public getAll(): AIKnowledgeItem[] {
    return [...this.memories];
  }

  public add(item: Omit<AIKnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): AIKnowledgeItem {
    const newItem: AIKnowledgeItem = {
      ...item,
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.memories.unshift(newItem);
    this.saveToStorage();
    return newItem;
  }

  public update(id: string, updates: Partial<Omit<AIKnowledgeItem, 'id' | 'createdAt'>>): AIKnowledgeItem | null {
    const idx = this.memories.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    const updated: AIKnowledgeItem = {
      ...this.memories[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.memories[idx] = updated;
    this.saveToStorage();
    return updated;
  }

  public remove(id: string): boolean {
    const initialLen = this.memories.length;
    this.memories = this.memories.filter((m) => m.id !== id);
    if (this.memories.length !== initialLen) {
      this.saveToStorage();
      return true;
    }
    return false;
  }

  public clearAll(): void {
    this.memories = [];
    this.saveToStorage();
  }

  public resetToDefaults(): void {
    this.memories = [...DEFAULT_MEMORIES];
    this.saveToStorage();
  }

  public getFormattedMemoryPrompt(): string {
    if (this.memories.length === 0) return '';
    return (
      `\n[SAVED AI CATBOT PERSISTENT MEMORY / KNOWLEDGE BASE]:\n` +
      this.memories
        .map(
          (m, idx) =>
            `${idx + 1}. [${m.category.toUpperCase()}] ${m.title}: ${m.content}`
        )
        .join('\n') +
      `\n`
    );
  }
}

export const memoryService = new MemoryService();
