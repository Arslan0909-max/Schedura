import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

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
const STRIKE_KEY = 'schedura_ai_offtopic_strike_v1';

class MemoryService {
  private memories: AIKnowledgeItem[] = [];
  private offTopicStreak: number = 0;
  private currentUserId: string | null = null;

  constructor() {
    this.loadMemories();
    this.loadOffTopicStreak();
  }

  private loadMemories(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out legacy dummy/mock preset memories so state starts 100% clean
          this.memories = parsed.filter((m) => m && !['mem-1', 'mem-2', 'mem-3'].includes(m.id));
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to load persistent memories from localStorage:', err);
    }
    this.memories = [];
    this.saveToStorage();
  }

  private loadOffTopicStreak(): void {
    try {
      const saved = localStorage.getItem(STRIKE_KEY);
      this.offTopicStreak = saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      this.offTopicStreak = 0;
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memories));
    } catch (err) {
      console.warn('Failed to save memories to localStorage:', err);
    }
  }

  public getOffTopicStreak(): number {
    return this.offTopicStreak;
  }

  public incrementOffTopicStreak(): number {
    this.offTopicStreak += 1;
    try {
      localStorage.setItem(STRIKE_KEY, String(this.offTopicStreak));
    } catch {}
    return this.offTopicStreak;
  }

  public resetOffTopicStreak(): void {
    this.offTopicStreak = 0;
    try {
      localStorage.setItem(STRIKE_KEY, '0');
    } catch {}
  }

  /**
   * Sync memory with Firestore for authenticated user
   */
  public async syncWithFirestore(userId: string): Promise<void> {
    this.currentUserId = userId;
    try {
      const colRef = collection(db, 'users', userId, 'memories');
      const snap = await getDocs(colRef);
      const cloudMemories: AIKnowledgeItem[] = [];
      snap.forEach((d) => {
        cloudMemories.push(d.data() as AIKnowledgeItem);
      });

      if (cloudMemories.length > 0) {
        // Set cloud memories
        this.memories = cloudMemories;
        this.saveToStorage();
      } else if (this.memories.length > 0) {
        // Push any existing memories to Firestore
        for (const mem of this.memories) {
          await setDoc(doc(db, 'users', userId, 'memories', mem.id), mem, { merge: true });
        }
      }
    } catch (e) {
      console.warn('Firestore memory sync note:', e);
    }
  }

  /**
   * Reset local memory when user logs out so state is completely clean & fresh
   */
  public handleUserLogout(): void {
    this.currentUserId = null;
    this.memories = [];
    this.offTopicStreak = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STRIKE_KEY);
    } catch {}
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

    // Also persist to Firestore if user is authenticated
    if (this.currentUserId) {
      setDoc(doc(db, 'users', this.currentUserId, 'memories', newItem.id), newItem, { merge: true }).catch(console.warn);
    }

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

    if (this.currentUserId) {
      setDoc(doc(db, 'users', this.currentUserId, 'memories', id), updated, { merge: true }).catch(console.warn);
    }

    return updated;
  }

  public remove(id: string): boolean {
    const initialLen = this.memories.length;
    this.memories = this.memories.filter((m) => m.id !== id);
    if (this.memories.length !== initialLen) {
      this.saveToStorage();
      if (this.currentUserId) {
        deleteDoc(doc(db, 'users', this.currentUserId, 'memories', id)).catch(console.warn);
      }
      return true;
    }
    return false;
  }

  public clearAll(): void {
    this.memories = [];
    this.saveToStorage();
  }

  public resetToDefaults(): void {
    this.memories = [];
    this.saveToStorage();
  }

  /**
   * Auto-learn from conversation text to build persistent personalization
   */
  public autoLearnFromConversation(userText: string): void {
    const lower = userText.toLowerCase();

    // Check for faculty availability preference
    if (
      (lower.includes('sir') || lower.includes('dr.') || lower.includes('prof') || lower.includes('teacher') || lower.includes('faculty')) &&
      (lower.includes('only') || lower.includes('sirf') || lower.includes('available') || lower.includes('free') || lower.includes('teaches') || lower.includes('parhayega') || lower.includes('shift') || lower.includes('timing') || lower.includes('time'))
    ) {
      const match = userText.match(/(?:sir|dr\.|prof\.|teacher|faculty)\s+([A-Za-z\s]+?)(?:\s+(?:ko|is|only|sirf|teaches|ki|available|free))/i);
      const teacherName = match ? match[1].trim() : 'Faculty Member';
      const existing = this.memories.find((m) => m.title.toLowerCase().includes(teacherName.toLowerCase()));
      if (existing) {
        this.update(existing.id, { content: `${existing.content} | Updated: ${userText}` });
      } else {
        this.add({
          category: 'teacher',
          title: `${teacherName} Preference/Assignment`,
          content: userText,
          tags: ['faculty', 'preference', 'auto-learned'],
        });
      }
    }

    // Check for room reservation or capacity preference
    if (
      (lower.includes('room') || lower.includes('lab') || lower.includes('hall') || lower.includes('auditorium') || lower.includes('r-')) &&
      (lower.includes('reserved') || lower.includes('khaas') || lower.includes('only for') || lower.includes('sirf') || lower.includes('capacity') || lower.includes('book') || lower.includes('assign'))
    ) {
      const roomMatch = userText.match(/(?:room\s*\w+|lab\s*\w+|hall\s*\w+|r-\d+)/i);
      const roomTitle = roomMatch ? roomMatch[0].toUpperCase() : 'Room/Lab Policy';
      const existing = this.memories.find((m) => m.title.toLowerCase() === roomTitle.toLowerCase());
      if (existing) {
        this.update(existing.id, { content: `${existing.content} | Updated: ${userText}` });
      } else {
        this.add({
          category: 'room',
          title: roomTitle,
          content: userText,
          tags: ['room', 'policy', 'auto-learned'],
        });
      }
    }

    // Check for University Rules / Timing / Break policies
    if (
      lower.includes('rule') ||
      lower.includes('break') ||
      lower.includes('lunch') ||
      lower.includes('namaz') ||
      lower.includes('prayer') ||
      lower.includes('juma') ||
      lower.includes('friday') ||
      lower.includes('policy') ||
      lower.includes('shift timing') ||
      lower.includes('no class on') ||
      lower.includes('chutti')
    ) {
      const existing = this.memories.find((m) => m.category === 'rule' && m.content.toLowerCase().slice(0, 30) === lower.slice(0, 30));
      if (!existing) {
        this.add({
          category: 'rule',
          title: 'University Schedule Policy',
          content: userText,
          tags: ['rule', 'timing', 'auto-learned'],
        });
      }
    }

    // Check for Project / Department memory directives
    if (
      (lower.includes('remember') || lower.includes('yaad rakhna') || lower.includes('note kar lo') || lower.includes('future') || lower.includes('hamesha') || lower.includes('always')) &&
      userText.length > 10
    ) {
      this.add({
        category: 'general',
        title: 'User Scheduling Directive',
        content: userText,
        tags: ['directive', 'preference', 'auto-learned'],
      });
    }
  }

  /**
   * Auto-records a created or updated timetable into persistent project memory
   * so that future timetable creations and other semester projects automatically know
   * which rooms, teachers, subjects, and slots are already in use!
   */
  public autoRecordProjectMemory(timetable: any): void {
    if (!timetable || !timetable.semester) return;

    const key = `proj-${timetable.semester}-${timetable.section || 'General'}`.toLowerCase().replace(/\s+/g, '-');
    const existingIdx = this.memories.findIndex((m) => m.id === key || m.title.toLowerCase().includes(timetable.semester.toLowerCase()));

    const teacherList = Array.from(
      new Set(
        (timetable.slots || [])
          .filter((s: any) => s.teacher && !s.isBreak)
          .map((s: any) => `${s.teacher} (${s.subject || 'Course'} in ${s.room || 'Room'})`)
      )
    ).join(', ');

    const roomList = Array.from(
      new Set((timetable.slots || []).filter((s: any) => s.room && !s.isBreak).map((s: any) => s.room))
    ).join(', ');

    const projectSummary = `Project: ${timetable.semester} (${timetable.section || 'Sec A'}) [${timetable.shift || 'Morning'}]. Rooms in use: [${roomList || 'None'}]. Faculty Assigned: [${teacherList || 'None'}]. Total Class Slots: ${(timetable.slots || []).length}.`;

    if (existingIdx !== -1) {
      this.update(this.memories[existingIdx].id, {
        content: projectSummary,
        tags: ['project', timetable.semester.toLowerCase(), timetable.shift?.toLowerCase() || 'morning'],
      });
    } else {
      this.add({
        category: 'project',
        title: `${timetable.semester} (${timetable.section || 'A'}) Project`,
        content: projectSummary,
        tags: ['project', timetable.semester.toLowerCase(), 'cross-project-context'],
      });
    }
  }

  public getFormattedMemoryPrompt(): string {
    if (this.memories.length === 0) return '';
    return (
      `\n[SAVED AI PERSISTENT MEMORY / KNOWLEDGE BASE (PRESERVED ACROSS SESSIONS)]:\n` +
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
