import React, { useState, useEffect } from 'react';
import { Brain, Plus, Trash2, Edit2, Search, X, Sparkles, Check, Bookmark, RefreshCw } from 'lucide-react';
import { memoryService, AIKnowledgeItem } from '../services/memoryService';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemoryUpdated?: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({ isOpen, onClose, onMemoryUpdated }) => {
  const [memories, setMemories] = useState<AIKnowledgeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'teacher' | 'room' | 'rule' | 'project'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'teacher' | 'course' | 'room' | 'rule' | 'project' | 'general'>('general');
  const [tagsInput, setTagsInput] = useState('');

  const refreshList = () => {
    setMemories(memoryService.getAll());
    if (onMemoryUpdated) onMemoryUpdated();
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    if (editingId) {
      memoryService.update(editingId, { title, content, category, tags });
      setEditingId(null);
    } else {
      memoryService.add({ title, content, category, tags });
    }

    // Reset form
    setTitle('');
    setContent('');
    setCategory('general');
    setTagsInput('');
    setIsAdding(false);
    refreshList();
  };

  const handleStartEdit = (item: AIKnowledgeItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setContent(item.content);
    setCategory(item.category);
    setTagsInput(item.tags ? item.tags.join(', ') : '');
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    memoryService.remove(id);
    refreshList();
  };

  const handleResetDefaults = () => {
    memoryService.resetToDefaults();
    refreshList();
  };

  const filteredMemories = memories.filter((m) => {
    const matchesTab = activeTab === 'all' || m.category === activeTab;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !q ||
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      (m.tags && m.tags.some((t) => t.includes(q)));
    return matchesTab && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white/95 dark:bg-[#18191E]/95 rounded-3xl shadow-2xl border border-white/60 dark:border-zinc-800 overflow-hidden soft-bounce text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-pink-50/50 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-pink-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 animate-soft-punch">
              <Brain className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                Schedura AI Persistent Memory
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  {memories.length} Memories & Projects Saved
                </span>
              </h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Institutional memory for teachers, rooms, cross-project collision prevention & university policies
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors punch-tap"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar & Category Tabs */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories, rules, teachers..."
                className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-white dark:bg-[#1F2028] border border-zinc-200 dark:border-zinc-700 rounded-2xl text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (isAdding) {
                    setIsAdding(false);
                    setEditingId(null);
                  } else {
                    setIsAdding(true);
                    setTitle('');
                    setContent('');
                    setCategory('general');
                    setTagsInput('');
                  }
                }}
                className={`px-3.5 py-1.5 rounded-2xl text-[12.5px] font-semibold flex items-center gap-1.5 transition-all shadow-xs punch-tap ${
                  isAdding
                    ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20'
                }`}
              >
                {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isAdding ? 'Cancel' : 'Add New Memory'}</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="p-1.5 rounded-2xl bg-white dark:bg-[#1F2028] border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors punch-tap"
                title="Reset default memories"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[12px]">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'teacher', label: 'Teachers' },
                { id: 'room', label: 'Rooms/Labs' },
                { id: 'rule', label: 'Schedule Rules' },
                { id: 'project', label: 'Projects' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap punch-tap ${
                  activeTab === tab.id
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xs'
                    : 'bg-white dark:bg-[#1F2028] border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Add / Edit Form */}
          {isAdding && (
            <form
              onSubmit={handleSave}
              className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-purple-50/50 to-white dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-zinc-900/60 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm space-y-3 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-2 border-b border-indigo-100 dark:border-indigo-900/60">
                <span className="text-[13px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  {editingId ? 'Edit Memory' : 'New Persistent Memory'}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Auto-saved to Schedura Memory</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Dr. Ayesha Friday Shift"
                    className="w-full px-3 py-1.5 text-[13px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-[13px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
                  >
                    <option value="teacher">Teacher / Faculty</option>
                    <option value="room">Room / Lab Facility</option>
                    <option value="rule">Timetable Rule / Constraint</option>
                    <option value="course">Course / Subject</option>
                    <option value="project">Project / Semester</option>
                    <option value="general">General Note</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase mb-1">Memory Content</label>
                <textarea
                  required
                  rows={2}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Describe the exact detail or rule Catbot should remember forever..."
                  className="w-full px-3 py-2 text-[13px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. friday, lab, morning"
                  className="w-full px-3 py-1.5 text-[13px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3.5 py-1.5 text-[12px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-semibold shadow-md shadow-indigo-500/20 flex items-center gap-1.5 punch-tap"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Memory</span>
                </button>
              </div>
            </form>
          )}

          {/* Memory List */}
          {filteredMemories.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Brain className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2 animate-bounce" />
              <p className="text-zinc-600 dark:text-zinc-300 text-[14px] font-medium">No memories found</p>
              <p className="text-zinc-400 dark:text-zinc-500 text-[12px] max-w-sm mx-auto mt-1">
                {searchQuery
                  ? 'Try adjusting your search filters.'
                  : 'Add custom rules or preferences so Catbot can personalize your future timetables.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredMemories.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1F2028] border border-zinc-200/80 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-600/50 shadow-xs hover:shadow-md transition-all duration-200 group relative soft-bounce"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          item.category === 'teacher'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : item.category === 'room'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : item.category === 'rule'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {item.category}
                      </span>
                      <h4 className="text-[14px] font-bold text-zinc-900 dark:text-white">{item.title}</h4>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                        title="Edit memory"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed mb-2">{item.content}</p>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-zinc-100 dark:border-zinc-800">
                      {item.tags.map((tag, idx) => (
                        <span key={idx} className="text-[10.5px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 flex items-center justify-between text-[12px] text-zinc-500 dark:text-zinc-400">
          <span>Synced with Schedura AI system instructions</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-medium punch-tap"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
