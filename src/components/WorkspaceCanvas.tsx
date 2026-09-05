import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Download,
  Share2,
  Calendar,
  Clock,
  MapPin,
  User,
  ShieldCheck,
  AlertTriangle,
  Coffee,
  Plus,
  Layers,
  Sparkles,
  Maximize2,
  CheckCircle,
  Pencil,
  FileText,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  Cloud,
  Check,
} from 'lucide-react';
import { TimetableData, TimetableSlot, Conflict } from '../types/timetable';
import { exportTimetableToPDF } from '../utils/pdfExport';
import { exportTimetableToExcel, exportTimetableToWord, printTimetable } from '../utils/exportEngine';
import { syncToGoogleSheets, signInWithGoogleWorkspace } from '../services/googleWorkspace';
import { SlotEditModal } from './SlotEditModal';
import { checkSlotConflict } from '../utils/conflictEngine';

interface WorkspaceCanvasProps {
  activeTimetable: TimetableData | null;
  allTimetables: TimetableData[];
  isVoiceProcessing?: boolean;
  onSelectTimetable: (id: string) => void;
  onUpdateTimetable: (updated: TimetableData) => void;
  onLoadSample?: (type: 'CS' | 'BBA') => void;
  globalSlots: TimetableSlot[];
  conflicts: Conflict[];
}

export const WorkspaceCanvas: React.FC<WorkspaceCanvasProps> = ({
  activeTimetable,
  allTimetables,
  isVoiceProcessing = false,
  onSelectTimetable,
  onUpdateTimetable,
  globalSlots,
  conflicts,
}) => {
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [draggedSlot, setDraggedSlot] = useState<TimetableSlot | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ day: string; timeSlot: string } | null>(null);
  const [dragWarning, setDragWarning] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'rooms' | 'teachers'>('grid');
  const [copiedShare, setCopiedShare] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isDraftingPencilActive, setIsDraftingPencilActive] = useState(false);
  const prevSlotsRef = useRef<string>(JSON.stringify(activeTimetable?.slots || []));

  // Trigger subtle floating pencil animation whenever AI modifies/generates timetable data
  useEffect(() => {
    if (isVoiceProcessing) {
      setIsDraftingPencilActive(true);
    } else {
      const currentSlotsStr = JSON.stringify(activeTimetable?.slots || []);
      if (currentSlotsStr !== prevSlotsRef.current) {
        prevSlotsRef.current = currentSlotsStr;
        setIsDraftingPencilActive(true);
        const timer = setTimeout(() => {
          setIsDraftingPencilActive(false);
        }, 3400);
        return () => clearTimeout(timer);
      }
    }
  }, [isVoiceProcessing, activeTimetable?.slots]);

  // Group slots by Room
  const roomsData = useMemo(() => {
    if (!activeTimetable) return [];
    const map = new Map<string, TimetableSlot[]>();
    activeTimetable.slots.forEach((s) => {
      if (s.room && !s.isBreak) {
        if (!map.has(s.room)) map.set(s.room, []);
        map.get(s.room)!.push(s);
      }
    });
    return Array.from(map.entries())
      .map(([room, slots]) => ({
        room,
        slots: slots.sort((a, b) => a.day.localeCompare(b.day) || a.timeSlot.localeCompare(b.timeSlot)),
      }))
      .sort((a, b) => a.room.localeCompare(b.room));
  }, [activeTimetable]);

  // Group slots by Teacher
  const teachersData = useMemo(() => {
    if (!activeTimetable) return [];
    const map = new Map<string, TimetableSlot[]>();
    activeTimetable.slots.forEach((s) => {
      if (s.teacher && !s.isBreak) {
        if (!map.has(s.teacher)) map.set(s.teacher, []);
        map.get(s.teacher)!.push(s);
      }
    });
    return Array.from(map.entries())
      .map(([teacher, slots]) => ({
        teacher,
        slots: slots.sort((a, b) => a.day.localeCompare(b.day) || a.timeSlot.localeCompare(b.timeSlot)),
        totalHours: slots.length,
      }))
      .sort((a, b) => a.teacher.localeCompare(b.teacher));
  }, [activeTimetable]);

  // Export Handlers
  const handleExportPDF = () => {
    if (!activeTimetable) return;
    setShowExportMenu(false);
    exportTimetableToPDF(activeTimetable);
  };

  const handleExportExcel = () => {
    if (!activeTimetable) return;
    setShowExportMenu(false);
    exportTimetableToExcel(activeTimetable);
  };

  const handleExportWord = () => {
    if (!activeTimetable) return;
    setShowExportMenu(false);
    exportTimetableToWord(activeTimetable);
  };

  const handlePrint = () => {
    if (!activeTimetable) return;
    setShowExportMenu(false);
    printTimetable(activeTimetable);
  };

  const handleSyncSheets = async () => {
    if (!activeTimetable) return;
    setShowExportMenu(false);
    setSyncStatus('Signing in & syncing to Google Sheets...');
    try {
      const { accessToken } = await signInWithGoogleWorkspace();
      const res = await syncToGoogleSheets(activeTimetable, accessToken);
      setSyncStatus(`Synced to Google Sheets!`);
      setTimeout(() => setSyncStatus(null), 3000);
      if (res.url) {
        window.open(res.url, '_blank');
      }
    } catch (err: any) {
      setSyncStatus(`Sync failed: ${err.message || 'Error'}`);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  // Share timetable
  const handleShare = () => {
    if (!activeTimetable) return;
    const summary = `${activeTimetable.semester} (${activeTimetable.section}) - ${activeTimetable.shift} Shift Timetable\nTotal classes: ${activeTimetable.slots.filter((s) => !s.isBreak).length}\nGenerated via Schedura AI`;
    navigator.clipboard.writeText(summary);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, slot: TimetableSlot) => {
    setDraggedSlot(slot);
    e.dataTransfer.setData('text/plain', slot.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, day: string, timeSlot: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (dragOverCell?.day !== day || dragOverCell?.timeSlot !== timeSlot) {
      setDragOverCell({ day, timeSlot });

      // Live conflict check for drag target
      if (draggedSlot && !draggedSlot.isBreak) {
        const testSlot: TimetableSlot = {
          ...draggedSlot,
          day,
          timeSlot,
        };
        const clash = checkSlotConflict(testSlot, globalSlots, draggedSlot.id);
        if (clash.length > 0) {
          setDragWarning(clash[0].title);
        } else {
          setDragWarning(null);
        }
      }
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
    setDragWarning(null);
  };

  const handleDrop = (e: React.DragEvent, targetDay: string, targetTimeSlot: string) => {
    e.preventDefault();
    setDragOverCell(null);
    setDragWarning(null);

    if (!draggedSlot || !activeTimetable) return;

    // Check if dropping on same slot
    if (draggedSlot.day === targetDay && draggedSlot.timeSlot === targetTimeSlot) {
      setDraggedSlot(null);
      return;
    }

    // Find if target cell already has a slot
    const existingAtTarget = activeTimetable.slots.find(
      (s) => s.day === targetDay && s.timeSlot === targetTimeSlot
    );

    let updatedSlots = [...activeTimetable.slots];

    if (existingAtTarget) {
      // Swap positions
      updatedSlots = updatedSlots.map((s) => {
        if (s.id === draggedSlot.id) {
          return { ...s, day: targetDay, timeSlot: targetTimeSlot };
        }
        if (s.id === existingAtTarget.id) {
          return { ...s, day: draggedSlot.day, timeSlot: draggedSlot.timeSlot };
        }
        return s;
      });
    } else {
      // Move to empty cell
      updatedSlots = updatedSlots.map((s) => {
        if (s.id === draggedSlot.id) {
          return { ...s, day: targetDay, timeSlot: targetTimeSlot };
        }
        return s;
      });
    }

    onUpdateTimetable({
      ...activeTimetable,
      slots: updatedSlots,
      updatedAt: new Date().toISOString(),
    });

    setDraggedSlot(null);
  };

  // Color mapping helper
  const getColorClasses = (colorName?: string) => {
    switch (colorName) {
      case 'indigo':
        return 'bg-indigo-50/90 border-indigo-200/80 text-indigo-950 hover:border-indigo-300';
      case 'blue':
        return 'bg-blue-50/90 border-blue-200/80 text-blue-950 hover:border-blue-300';
      case 'emerald':
        return 'bg-emerald-50/90 border-emerald-200/80 text-emerald-950 hover:border-emerald-300';
      case 'amber':
        return 'bg-amber-50/90 border-amber-200/80 text-amber-950 hover:border-amber-300';
      case 'rose':
        return 'bg-rose-50/90 border-rose-200/80 text-rose-950 hover:border-rose-300';
      case 'purple':
        return 'bg-purple-50/90 border-purple-200/80 text-purple-950 hover:border-purple-300';
      case 'teal':
        return 'bg-teal-50/90 border-teal-200/80 text-teal-950 hover:border-teal-300';
      default:
        return 'bg-zinc-50 border-zinc-200 text-zinc-900 hover:border-zinc-300';
    }
  };

  const getPillColor = (colorName?: string) => {
    switch (colorName) {
      case 'indigo':
        return 'bg-indigo-100/90 text-indigo-700';
      case 'blue':
        return 'bg-blue-100/90 text-blue-700';
      case 'emerald':
        return 'bg-emerald-100/90 text-emerald-700';
      case 'amber':
        return 'bg-amber-100/90 text-amber-700';
      case 'rose':
        return 'bg-rose-100/90 text-rose-700';
      case 'purple':
        return 'bg-purple-100/90 text-purple-700';
      case 'teal':
        return 'bg-teal-100/90 text-teal-700';
      default:
        return 'bg-zinc-200 text-zinc-700';
    }
  };

  return (
    <main
      id="schedura-workspace-canvas"
      className="flex-1 min-w-0 h-full bg-[#F8F9FA] flex flex-col overflow-hidden select-none"
    >
      {/* Top Header matching exact screenshot: "Work Space" with Export and Share */}
      <header className="h-14 border-b border-zinc-200/70 px-6 flex items-center justify-between bg-white/70 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-[17px] font-semibold text-zinc-900 tracking-tight">Work Space</h1>
          {activeTimetable && (
            <span className="text-[13px] text-zinc-500 font-normal">
              — {activeTimetable.semester} ({activeTimetable.section})
            </span>
          )}
        </div>

        {/* Top Right Action Buttons with Export Dropdown */}
        <div className="flex items-center gap-2.5">
          {syncStatus && (
            <div className="px-3 py-1 rounded-xl bg-zinc-900 text-white text-[11.5px] font-medium animate-in fade-in flex items-center gap-1.5 shadow-md">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>{syncStatus}</span>
            </div>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button
              id="btn-workspace-export"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!activeTimetable}
              className={`px-3.5 py-1.5 rounded-xl border border-zinc-200/80 bg-white text-[13px] font-medium transition-all duration-150 flex items-center gap-1.5 shadow-2xs ${
                activeTimetable
                  ? 'text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 active:scale-95'
                  : 'text-zinc-300 border-zinc-200 cursor-not-allowed'
              }`}
              title="Export Timetable in multiple formats"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {showExportMenu && activeTimetable && (
              <div className="absolute top-10 right-0 w-64 p-1.5 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-zinc-200/80 z-50 text-[12.5px] animate-in fade-in zoom-in-95 space-y-0.5">
                <div className="px-3 py-1.5 text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Export Document Formats
                </div>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="w-full text-left px-3 py-2 rounded-xl text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2.5"
                >
                  <FileText className="w-4 h-4 text-rose-500" />
                  <div className="flex-1">
                    <div className="font-medium text-[12.5px]">PDF Document (.pdf)</div>
                    <div className="text-[10.5px] text-zinc-400">High-resolution vector printable grid</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportWord}
                  className="w-full text-left px-3 py-2 rounded-xl text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2.5"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-[12.5px]">Microsoft Word (.doc)</div>
                    <div className="text-[10.5px] text-zinc-400">Editable schedule document table</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full text-left px-3 py-2 rounded-xl text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div className="flex-1">
                    <div className="font-medium text-[12.5px]">Microsoft Excel (.xlsx)</div>
                    <div className="text-[10.5px] text-zinc-400">Multi-tab spreadsheet matrix</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full text-left px-3 py-2 rounded-xl text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2.5"
                >
                  <Printer className="w-4 h-4 text-zinc-600" />
                  <div className="flex-1">
                    <div className="font-medium text-[12.5px]">Print Timetable</div>
                    <div className="text-[10.5px] text-zinc-400">Direct print layout for campus boards</div>
                  </div>
                </button>

                <div className="my-1 border-t border-zinc-100" />
                <div className="px-3 py-1 text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Cloud Sync
                </div>

                <button
                  type="button"
                  onClick={handleSyncSheets}
                  className="w-full text-left px-3 py-2 rounded-xl text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2.5"
                >
                  <Cloud className="w-4 h-4 text-emerald-600" />
                  <div className="flex-1">
                    <div className="font-medium text-[12.5px]">Sync to Google Sheets</div>
                    <div className="text-[10.5px] text-zinc-400">Save directly to your Google Drive</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            id="btn-workspace-share"
            onClick={handleShare}
            disabled={!activeTimetable}
            className={`px-3.5 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-150 flex items-center gap-2 shadow-sm ${
              activeTimetable
                ? 'bg-zinc-900 hover:bg-zinc-800 text-white active:scale-95'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {copiedShare ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Sub-toolbar: Active Semester/Section Tabs & View Mode & Conflict Engine Status */}
      {activeTimetable && (
        <div className="px-6 py-2.5 border-b border-zinc-200/60 bg-white/40 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Section Tabs & View Mode Switcher */}
          <div className="flex items-center gap-3 overflow-x-auto py-0.5">
            <div className="flex items-center gap-1.5">
              {allTimetables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTimetable(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all whitespace-nowrap ${
                    t.id === activeTimetable.id
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-white/80 border border-zinc-200/70 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {t.semester} ({t.section})
                </button>
              ))}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-zinc-100/90 p-0.5 rounded-xl border border-zinc-200/80">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Grid View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('rooms')}
                className={`px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-all ${
                  viewMode === 'rooms'
                    ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Room Allocation
              </button>
              <button
                type="button"
                onClick={() => setViewMode('teachers')}
                className={`px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-all ${
                  viewMode === 'teachers'
                    ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Faculty Schedule
              </button>
            </div>
          </div>

          {/* Engine Status Pill */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium ${
                conflicts.length === 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                  : 'bg-rose-50 text-rose-700 border border-rose-200/70'
              }`}
            >
              {conflicts.length === 0 ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Conflict-Free Global Memory</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>{conflicts.length} Conflict(s) in Global State</span>
                </>
              )}
            </div>

            {/* Shift Badge */}
            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/60">
              Shift: {activeTimetable.shift}
            </span>
          </div>
        </div>
      )}

      {/* Main Canvas Workspace Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6 relative">
        {/* Subtle, Floating Pencil Icon Animation tracking over canvas */}
        {isDraftingPencilActive && (
          <div
            id="floating-pencil-tracker"
            className="pointer-events-none absolute z-40 animate-pencil-track flex items-center gap-2 select-none"
          >
            {/* Elegant Pencil Badge with Luminous Point */}
            <div className="relative flex items-center justify-center p-2 rounded-2xl bg-white/95 backdrop-blur-md border border-zinc-200/90 shadow-[0_10px_25px_rgba(0,0,0,0.12)]">
              <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.9)] animate-ping opacity-80" />
              <span className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-xs" />
              <Pencil className="w-4 h-4 text-zinc-900 -rotate-45 transform origin-bottom-left" />
            </div>

            {/* Subtle Pill Tag */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 text-white text-[11px] font-medium backdrop-blur-md shadow-lg border border-zinc-800/80">
              <Sparkles className="w-3 h-3 text-amber-300 animate-spin" style={{ animationDuration: '3s' }} />
              <span>AI Sketching Grid...</span>
            </div>
          </div>
        )}
        {isVoiceProcessing ? (
          /* Elegant Drafting Pencil Sketch Animation on Technical Blueprint Grid */
          <div
            id="workspace-pencil-sketching"
            className="w-full h-full min-h-[460px] bg-white rounded-3xl border border-zinc-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col p-6 animate-in fade-in duration-300 relative"
          >
            {/* Blueprint Grid Drafting Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
                  <Pencil className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-zinc-900 tracking-tight">
                    Drafting Schedule Blueprint
                  </h3>
                  <p className="text-[11.5px] text-zinc-500">
                    Arranging courses, assigning rooms, and balancing faculty allocations...
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-medium border border-zinc-200/60">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero Clashes Verified</span>
              </div>
            </div>

            {/* Architectural Drafting Blueprint Canvas with Pencil Moving Effect */}
            <div className="mt-5 flex-1 rounded-2xl bg-zinc-50/60 border border-zinc-200/80 p-4 relative flex flex-col justify-between overflow-hidden">
              {/* Technical Grid lines drawing */}
              <div className="grid grid-cols-5 gap-3 flex-1">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, dIdx) => (
                  <div key={day} className="flex flex-col gap-2.5">
                    <div className="h-6 rounded-lg bg-zinc-200/70 flex items-center justify-center text-[10.5px] font-semibold text-zinc-600">
                      {day}
                    </div>
                    {[0, 1, 2, 3, 4].map((slotIdx) => (
                      <div
                        key={slotIdx}
                        className="flex-1 min-h-[58px] rounded-xl border border-zinc-200/90 bg-white/90 p-2.5 flex flex-col justify-between relative transition-all duration-300 shadow-2xs"
                        style={{
                          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                          animationDelay: `${(dIdx * 5 + slotIdx) * 60}ms`,
                        }}
                      >
                        <div className="h-2 w-4/5 rounded bg-zinc-200" />
                        <div className="h-1.5 w-1/2 rounded bg-zinc-100" />
                        <div className="h-1.5 w-1/3 rounded bg-zinc-100" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Centered Floating Sketching Status with Animated Pencil */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="px-5 py-3 rounded-2xl bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-xl flex items-center gap-3 animate-in zoom-in-95">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center animate-spin" style={{ animationDuration: '4s' }}>
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-zinc-900">
                      Schedura is sketching timetable grid...
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Resolving constraints in real-time
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : !activeTimetable ? (
          /* Clean Minimal Fresh Empty State */
          <div
            id="workspace-empty-state"
            className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto select-none animate-in fade-in duration-300"
          >
            <div className="w-14 h-14 rounded-2xl bg-white border border-zinc-200/80 shadow-xs flex items-center justify-center text-zinc-400 mb-3.5">
              <Calendar className="w-7 h-7 stroke-[1.25]" />
            </div>
            <h2 className="text-[17px] font-semibold text-zinc-900 tracking-tight mb-1.5">
              Your timetable grid will appear here
            </h2>
            <p className="text-[13px] text-zinc-500 leading-relaxed max-w-sm mb-4">
              Ask or speak to Schedura in the chat to create, allocate, and orchestrate a clash-free schedule.
            </p>
            <div className="flex items-center gap-2 text-[11.5px] text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Conflict Prevention Standby</span>
            </div>
          </div>
        ) : viewMode === 'rooms' ? (
          /* Room Allocation Matrix */
          <div id="room-allocation-matrix" className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-zinc-900">Room Allocation Matrix</h2>
                <p className="text-[12px] text-zinc-500">Real-time room occupancy and collision checks across all week slots</p>
              </div>
              <div className="text-[12px] text-zinc-600 bg-white px-3 py-1.5 rounded-xl border border-zinc-200/80 shadow-2xs">
                {roomsData.length} Rooms Allocated
              </div>
            </div>

            {roomsData.length === 0 ? (
              <div className="bg-white rounded-3xl border border-zinc-200/80 p-8 text-center text-zinc-400">
                No classrooms assigned yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roomsData.map(({ room, slots }) => (
                  <div key={room} className="bg-white rounded-3xl border border-zinc-200/80 p-4 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-800 font-bold text-[12px]">
                          {room.slice(0, 3)}
                        </div>
                        <div>
                          <h3 className="text-[14px] font-semibold text-zinc-900">{room}</h3>
                          <span className="text-[11px] text-zinc-500">{slots.length} Classes Assigned</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        Operational
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {slots.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => setEditingSlot(s)}
                          className="p-2.5 rounded-2xl border border-zinc-100 bg-zinc-50/60 hover:bg-zinc-100 cursor-pointer transition-colors text-[12px] flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-zinc-800">{s.subject}</div>
                            <div className="text-[11px] text-zinc-500">{s.teacher || 'Instructor TBA'}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-medium text-zinc-700">{s.day}</span>
                            <div className="text-[10px] text-zinc-400">{s.timeSlot}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : viewMode === 'teachers' ? (
          /* Faculty Schedule & Workload View */
          <div id="faculty-schedule-matrix" className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-zinc-900">Faculty Schedule & Workload</h2>
                <p className="text-[12px] text-zinc-500">Instructor teaching hours and room allocations across the academic week</p>
              </div>
              <div className="text-[12px] text-zinc-600 bg-white px-3 py-1.5 rounded-xl border border-zinc-200/80 shadow-2xs">
                {teachersData.length} Faculty Members
              </div>
            </div>

            {teachersData.length === 0 ? (
              <div className="bg-white rounded-3xl border border-zinc-200/80 p-8 text-center text-zinc-400">
                No faculty members assigned yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teachersData.map(({ teacher, slots, totalHours }) => (
                  <div key={teacher} className="bg-white rounded-3xl border border-zinc-200/80 p-4 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[12px]">
                          <User className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-[14px] font-semibold text-zinc-900">{teacher}</h3>
                          <span className="text-[11px] text-zinc-500">{totalHours} Teaching Classes/Week</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                        {totalHours}h Load
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {slots.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => setEditingSlot(s)}
                          className="p-2.5 rounded-2xl border border-zinc-100 bg-zinc-50/60 hover:bg-zinc-100 cursor-pointer transition-colors text-[12px] flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-zinc-800">{s.subject}</div>
                            <div className="text-[11px] text-zinc-500">{s.room || 'Room TBA'}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-medium text-zinc-700">{s.day}</span>
                            <div className="text-[10px] text-zinc-400">{s.timeSlot}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Active Live Grid Timetable */
          <div
            id="live-timetable-grid"
            className="w-full bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Timetable Title Header inside Card */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h2 className="text-[16px] font-semibold text-zinc-900">
                  {activeTimetable.semester} • {activeTimetable.section}
                </h2>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  Drag and drop class blocks to re-schedule • Click any slot for inline editing
                </p>
              </div>

              {dragWarning && (
                <div className="px-3 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11.5px] font-medium flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{dragWarning}</span>
                </div>
              )}
            </div>

            {/* The Grid Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left min-w-[760px]">
                <thead>
                  <tr className="border-b border-zinc-200/80 bg-zinc-50/80">
                    <th className="w-24 px-4 py-3.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-50/95 z-10 border-r border-zinc-200/60">
                      Day
                    </th>
                    {activeTimetable.timeSlots.map((slot) => (
                      <th
                        key={slot}
                        className="px-3 py-3 text-center text-[11.5px] font-semibold text-zinc-600 border-r border-zinc-200/60 last:border-r-0"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span>{slot}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-200/60">
                  {activeTimetable.days.map((day) => (
                    <tr key={day} className="group hover:bg-zinc-50/40 transition-colors">
                      {/* Day Header Cell */}
                      <td className="px-4 py-3 text-[13px] font-semibold text-zinc-900 sticky left-0 bg-white/95 group-hover:bg-zinc-50/90 z-10 border-r border-zinc-200/60 shadow-2xs">
                        <div className="flex flex-col">
                          <span>{day.slice(0, 3)}</span>
                          <span className="text-[10.5px] text-zinc-400 font-normal">{day}</span>
                        </div>
                      </td>

                      {/* Time Slot Cells */}
                      {activeTimetable.timeSlots.map((timeSlot) => {
                        const cellSlot = activeTimetable.slots.find(
                          (s) => s.day === day && s.timeSlot === timeSlot
                        );

                        const isTargetCell =
                          dragOverCell?.day === day && dragOverCell?.timeSlot === timeSlot;

                        // Check if this slot has a conflict
                        const hasConflict =
                          cellSlot &&
                          !cellSlot.isBreak &&
                          conflicts.some(
                            (c) => c.slot1.id === cellSlot.id || c.slot2.id === cellSlot.id
                          );

                        return (
                          <td
                            key={timeSlot}
                            onDragOver={(e) => handleDragOver(e, day, timeSlot)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, day, timeSlot)}
                            className={`p-2 border-r border-zinc-200/60 last:border-r-0 h-24 align-top transition-all duration-150 relative ${
                              isTargetCell
                                ? dragWarning
                                  ? 'bg-rose-50/80 ring-2 ring-rose-400 ring-inset'
                                  : 'bg-indigo-50/80 ring-2 ring-indigo-400 ring-inset'
                                : ''
                            }`}
                          >
                            {cellSlot ? (
                              cellSlot.isBreak ? (
                                /* Break Card */
                                <div
                                  onClick={() => setEditingSlot(cellSlot)}
                                  className="w-full h-full rounded-2xl p-2.5 bg-zinc-100/80 border border-zinc-200/60 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-zinc-200/60 transition-all group/break"
                                >
                                  <Coffee className="w-4 h-4 text-zinc-400 mb-1 group-hover/break:scale-110 transition-transform" />
                                  <span className="text-[11.5px] font-medium text-zinc-600">
                                    {cellSlot.breakLabel || 'Break & Prayer'}
                                  </span>
                                  <span className="text-[10px] text-zinc-400">Recess</span>
                                </div>
                              ) : (
                                /* Class Slot Card */
                                <div
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, cellSlot)}
                                  onClick={() => setEditingSlot(cellSlot)}
                                  className={`w-full h-full rounded-2xl p-2.5 border shadow-2xs cursor-grab active:cursor-grabbing transition-all duration-150 flex flex-col justify-between relative group/card ${getColorClasses(
                                    cellSlot.color
                                  )} ${hasConflict ? 'ring-2 ring-rose-500 animate-pulse' : ''}`}
                                >
                                  {/* Subject Title */}
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="text-[12px] font-semibold leading-tight line-clamp-2">
                                      {cellSlot.subject}
                                    </span>
                                    {hasConflict && (
                                      <AlertTriangle
                                        className="w-3.5 h-3.5 text-rose-600 shrink-0"
                                        title="Double-booking conflict detected!"
                                      />
                                    )}
                                  </div>

                                  {/* Teacher & Room */}
                                  <div className="pt-1.5 space-y-1">
                                    {cellSlot.teacher && (
                                      <div className="flex items-center gap-1 text-[11px] opacity-80 truncate">
                                        <User className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{cellSlot.teacher}</span>
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                      <span
                                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${getPillColor(
                                          cellSlot.color
                                        )}`}
                                      >
                                        {cellSlot.room || 'TBA'}
                                      </span>

                                      <span className="text-[9.5px] opacity-60 font-medium group-hover/card:opacity-100 transition-opacity">
                                        Drag ⇄
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            ) : (
                              /* Empty Cell */
                              <div
                                onClick={() => {
                                  // Create a new slot in this cell
                                  const newSlot: TimetableSlot = {
                                    id: `slot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                    semester: activeTimetable.semester,
                                    section: activeTimetable.section,
                                    shift: activeTimetable.shift,
                                    day,
                                    timeSlot,
                                    subject: 'New Course',
                                    teacher: '',
                                    room: 'R-11',
                                    color: 'indigo',
                                    isBreak: false,
                                  };
                                  setEditingSlot(newSlot);
                                }}
                                className="w-full h-full rounded-2xl border border-dashed border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50/60 flex items-center justify-center text-zinc-300 hover:text-zinc-500 cursor-pointer transition-colors group/empty"
                              >
                                <Plus className="w-4 h-4 opacity-0 group-hover/empty:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Inline Slot Editing Glass Modal */}
      {editingSlot && activeTimetable && (
        <SlotEditModal
          slot={editingSlot}
          isOpen={Boolean(editingSlot)}
          onClose={() => setEditingSlot(null)}
          allDays={activeTimetable.days}
          allTimeSlots={activeTimetable.timeSlots}
          globalSlots={globalSlots}
          onSave={(updated) => {
            const exists = activeTimetable.slots.some((s) => s.id === updated.id);
            const newSlots = exists
              ? activeTimetable.slots.map((s) => (s.id === updated.id ? updated : s))
              : [...activeTimetable.slots, updated];

            onUpdateTimetable({
              ...activeTimetable,
              slots: newSlots,
              updatedAt: new Date().toISOString(),
            });
            setEditingSlot(null);
          }}
          onDelete={(id) => {
            onUpdateTimetable({
              ...activeTimetable,
              slots: activeTimetable.slots.filter((s) => s.id !== id),
              updatedAt: new Date().toISOString(),
            });
            setEditingSlot(null);
          }}
        />
      )}
    </main>
  );
};
