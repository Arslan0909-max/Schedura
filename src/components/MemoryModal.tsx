import React, { useState, useEffect } from 'react';
import { Brain, Plus, Trash2, Edit2, Search, X, Check, Bookmark, RefreshCw } from 'lucide-react';
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
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white/95 dark:bg-[#15161C]/95 rounded-3xl shadow-2xl border border-white/60 dark:border-zinc-800/80 overflow-hidden text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-zinc-200/70 dark:border-zinc-800/80 bg-white/60 dark:bg-[#181920]/60 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
                Schedura AI Persistent Memory
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/80 shadow-2xs">
                  {memories.length} Memories & Projects Saved
                </span>
              </h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-normal">
                Institutional memory for faculty availability, room capacities, collision rules & university policies
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8.5 h-8.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-all punch-tap cursor-pointer border border-zinc-200/60 dark:border-zinc-700/60"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar & Category Tabs */}
        <div className="p-4 border-b border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/60 backdrop-blur-md space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories, rules, teachers..."
                className="w-full pl-9.5 pr-4 py-2 text-[13px] bg-white dark:bg-[#1C1D24] border border-zinc-200/80 dark:border-zinc-700/80 rounded-2xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/80 shadow-2xs transition-all"
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
                className={`px-4 py-2 rounded-2xl text-[12.5px] font-semibold flex items-center gap-1.5 transition-all shadow-xs punch-tap cursor-pointer ${
                  isAdding
                    ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 border border-zinc-300/60 dark:border-zinc-700'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25 border border-indigo-500/80'
                }`}
              >
                {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isAdding ? 'Cancel' : 'Add New Memory'}</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="p-2 rounded-2xl bg-white dark:bg-[#1C1D24] border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors punch-tap cursor-pointer shadow-2xs"
                title="Reset default memories"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[12px]">
            {(
              [
                { id: 'all', label: 'All Knowledge' },
                { id: 'teacher', label: 'Faculty' },
                { id: 'room', label: 'Rooms & Labs' },
                { id: 'rule', label: 'Rules & Constraints' },
                { id: 'project', label: 'Projects' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.2 rounded-full font-medium transition-all whitespace-nowrap punch-tap cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs font-semibold'
                    : 'bg-white/80 dark:bg-[#1C1D24]/80 border border-zinc-200/70 dark:border-zinc-700/70 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Add / Edit Form */}
          {isAdding && (
            <form
              onSubmit={handleSave}
              className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-white dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-zinc-900/80 border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-indigo-100 dark:border-indigo-900/60">
                <span className="text-[13.5px] font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  {editingId ? 'Edit Stored Memory' : 'New Persistent Memory Rule'}
                </span>
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Auto-persisted across sessions</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Dr. Ayesha Friday Shift"
                    className="w-full px-3.5 py-2 text-[13px] bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-[13px] bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none shadow-2xs"
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
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Memory Content</label>
                <textarea
                  required
                  rows={2.5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Describe the exact detail or constraint Schedura AI should remember..."
                  className="w-full px-3.5 py-2.5 text-[13px] bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none resize-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. friday, lab, morning"
                  className="w-full px-3.5 py-2 text-[13px] bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none shadow-2xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-semibold shadow-md shadow-indigo-500/20 flex items-center gap-1.5 punch-tap cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Memory</span>
                </button>
              </div>
            </form>
          )}

          {/* Memory List */}
          {filteredMemories.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800">
              <Brain className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2.5" />
              <p className="text-zinc-700 dark:text-zinc-200 text-[14px] font-semibold">No knowledge items match</p>
              <p className="text-zinc-400 dark:text-zinc-500 text-[12px] max-w-sm mx-auto mt-1">
                {searchQuery
                  ? 'Try adjusting your search query or category filter.'
                  : 'Add custom rules or preferences so Schedura AI can personalize your university timetables.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredMemories.map((item) => (
                <div
                  key={item.id}
                  className="p-4.5 rounded-2xl bg-white dark:bg-[#1A1B22] border border-zinc-200/80 dark:border-zinc-800/80 hover:border-indigo-300 dark:hover:border-indigo-600/50 shadow-2xs hover:shadow-md transition-all duration-200 group relative"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          item.category === 'teacher'
                            ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                            : item.category === 'room'
                            ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60'
                            : item.category === 'rule'
                            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                            : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                        }`}
                      >
                        {item.category}
                      </span>
                      <h4 className="text-[14.5px] font-bold text-zinc-900 dark:text-white tracking-tight">{item.title}</h4>
                    </div>

                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                        title="Edit memory"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed mb-2.5">{item.content}</p>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                      {item.tags.map((tag, idx) => (
                        <span key={idx} className="text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50">
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
        <div className="p-4.5 border-t border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-900/90 flex items-center justify-between text-[12px] text-zinc-500 dark:text-zinc-400">
          <span className="font-medium">Synced with Schedura AI system instructions</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4.5 py-1.8 rounded-xl bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold punch-tap cursor-pointer shadow-xs transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
