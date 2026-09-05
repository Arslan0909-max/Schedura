import React, { useState, useMemo } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  Check,
  Search,
  Sparkles,
  X,
  Sliders,
  FolderKanban,
  FileText,
  ShieldCheck,
  Download,
  Upload,
  RotateCcw,
  Tag,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { BotMemory, MemoryCategory } from '../types/timetable';
import { DEFAULT_INITIAL_MEMORIES } from '../utils/memoryManager';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: BotMemory[];
  onSaveMemories: (memories: BotMemory[]) => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  memories,
  onSaveMemories,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('preference');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const matchCat = selectedCategory === 'all' || m.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [memories, selectedCategory, searchQuery]);

  const activeCount = useMemo(() => memories.filter((m) => m.enabled).length, [memories]);

  if (!isOpen) return null;

  const handleToggleMemory = (id: string) => {
    const updated = memories.map((m) =>
      m.id === id ? { ...m, enabled: !m.enabled, updatedAt: new Date().toISOString() } : m
    );
    onSaveMemories(updated);
  };

  const handleDeleteMemory = (id: string) => {
    const updated = memories.filter((m) => m.id !== id);
    onSaveMemories(updated);
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newMem: BotMemory = {
      id: `mem-${Date.now()}`,
      category: newCategory,
      title: newTitle.trim(),
      content: newContent.trim(),
      enabled: true,
      source: 'user_defined',
      createdAt: new Date().toISOString(),
    };

    onSaveMemories([newMem, ...memories]);
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
  };

  const handleResetPresets = () => {
    if (window.confirm('Reset all bot memories to default scheduling presets?')) {
      onSaveMemories(DEFAULT_INITIAL_MEMORIES);
    }
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(memories, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `schedura-memories-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setCopiedNotification('Memories exported to JSON!');
    setTimeout(() => setCopiedNotification(null), 2500);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onSaveMemories(parsed);
          setCopiedNotification('Memories imported successfully!');
          setTimeout(() => setCopiedNotification(null), 2500);
        }
      } catch {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getCategoryBadge = (cat: MemoryCategory) => {
    switch (cat) {
      case 'rule':
        return {
          label: 'Scheduling Rule',
          icon: ShieldCheck,
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'preference':
        return {
          label: 'Preference',
          icon: Sliders,
          className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        };
      case 'project':
        return {
          label: 'Project Context',
          icon: FolderKanban,
          className: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'note':
      default:
        return {
          label: 'Note / Memory',
          icon: FileText,
          className: 'bg-purple-50 text-purple-700 border-purple-200',
        };
    }
  };

  return (
    <div
      id="schedura-memory-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-zinc-950/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="schedura-memory-modal-content"
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-zinc-200/80 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 soft-bounce">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-900">
                  Schedura Memory System
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/60">
                  {activeCount} Active
                </span>
              </div>
              <p className="text-[12px] text-zinc-500">
                Persistent memory, user preferences, and institutional rules remembered across projects.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors punch-tap"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action bar & Category Filters */}
        <div className="p-4 sm:px-6 bg-white border-b border-zinc-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search memories, rules, faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 text-[13px] bg-zinc-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsAdding(!isAdding)}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition-all punch-tap ${
                  isAdding
                    ? 'bg-zinc-900 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-500/20'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAdding ? 'Close Form' : 'Add Memory'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportJSON}
                className="p-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors punch-tap"
                title="Export memories to JSON"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <label
                className="p-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors punch-tap cursor-pointer"
                title="Import memories from JSON"
              >
                <Upload className="w-3.5 h-3.5" />
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>

              <button
                type="button"
                onClick={handleResetPresets}
                className="p-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors punch-tap"
                title="Reset to default presets"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11.5px]">
            {(
              [
                { id: 'all', label: 'All Memories' },
                { id: 'rule', label: '🎓 Rules' },
                { id: 'preference', label: '⚙️ Preferences' },
                { id: 'project', label: '📁 Projects' },
                { id: 'note', label: '💡 Notes' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`px-3 py-1 rounded-full font-medium transition-all shrink-0 punch-tap ${
                  selectedCategory === tab.id
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Add Memory Expandable Form */}
        {isAdding && (
          <form
            onSubmit={handleAddMemory}
            className="p-4 sm:px-6 bg-indigo-50/40 border-b border-indigo-100 animate-in slide-in-from-top-3 duration-200 space-y-3"
          >
            <div className="text-[12px] font-bold text-indigo-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Create New Bot Memory</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <label className="text-[10.5px] font-semibold text-zinc-600 uppercase tracking-wide block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lab Session Duration"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-semibold text-zinc-600 uppercase tracking-wide block mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                  className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="preference">⚙️ Preference</option>
                  <option value="rule">🎓 Rule</option>
                  <option value="project">📁 Project</option>
                  <option value="note">💡 Note</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10.5px] font-semibold text-zinc-600 uppercase tracking-wide block mb-1">
                Instruction / Memory Content
              </label>
              <textarea
                placeholder="Describe what Schedura should always remember (e.g. Always assign Dr. Bilal to Room 11 for Management courses)."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                required
                rows={2}
                className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 rounded-xl text-[12px] font-medium text-zinc-600 hover:bg-zinc-200/70 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs punch-tap"
              >
                Save Memory
              </button>
            </div>
          </form>
        )}

        {/* Notification Toast */}
        {copiedNotification && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-medium flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{copiedNotification}</span>
          </div>
        )}

        {/* Memories List */}
        <div
          id="schedura-memory-list-scrollable"
          className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 overscroll-contain"
        >
          {filteredMemories.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-zinc-200 rounded-3xl bg-zinc-50/50">
              <Brain className="w-10 h-10 text-zinc-300 mx-auto mb-2 animate-pulse" />
              <div className="text-sm font-semibold text-zinc-700">No Memories Found</div>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? 'No memories match your search filter.'
                  : 'Add custom rules or tell Schedura "Remember that..." in chat to build long-term memory!'}
              </p>
            </div>
          ) : (
            filteredMemories.map((mem) => {
              const badge = getCategoryBadge(mem.category);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={mem.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 soft-bounce ${
                    mem.enabled
                      ? 'bg-white border-zinc-200/90 shadow-xs hover:border-zinc-300 hover:shadow-md'
                      : 'bg-zinc-50/60 border-zinc-200/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${badge.className}`}
                        >
                          <BadgeIcon className="w-2.5 h-2.5" />
                          {badge.label}
                        </span>

                        <span className="text-[13.5px] font-bold text-zinc-900">
                          {mem.title}
                        </span>

                        {mem.source === 'auto_learned' && (
                          <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-purple-50 text-purple-600 border border-purple-200 font-medium">
                            Auto-Learned
                          </span>
                        )}
                      </div>

                      <p className="text-[12.5px] text-zinc-600 leading-relaxed">
                        {mem.content}
                      </p>

                      <div className="text-[10px] text-zinc-400">
                        Added {new Date(mem.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleMemory(mem.id)}
                        className={`p-1.5 rounded-xl transition-colors punch-tap ${
                          mem.enabled ? 'text-indigo-600 hover:bg-indigo-50' : 'text-zinc-400 hover:bg-zinc-100'
                        }`}
                        title={mem.enabled ? 'Disable memory' : 'Enable memory'}
                      >
                        {mem.enabled ? (
                          <ToggleRight className="w-6 h-6 text-indigo-600" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-zinc-400" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(mem.id)}
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors punch-tap"
                        title="Delete memory"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-3 sm:px-6 bg-zinc-50 border-t border-zinc-100 text-[11.5px] text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Memories are injected automatically into Gemini 3.1 Live & chat context.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition-colors punch-tap"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
