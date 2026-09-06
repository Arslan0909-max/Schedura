import React from 'react';
import { X, Calendar, Clock, Trash2, ArrowRight } from 'lucide-react';
import { TimetableData } from '../types/timetable';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  timetables: TimetableData[];
  onSelectTimetable: (id: string) => void;
  onDeleteTimetable: (id: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  timetables,
  onSelectTimetable,
  onDeleteTimetable,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white/95 dark:bg-[#18191E]/95 backdrop-blur-2xl border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <div>
            <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white">Schedule History</h3>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
              Timetables generated and synced to Global Memory
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {timetables.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-[13.5px]">
            No previous timetables generated yet. Start clean with Schedura on the left panel!
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {timetables.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#1F2028] hover:bg-zinc-50 dark:hover:bg-zinc-800/80 flex items-center justify-between transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="text-[14px] font-semibold text-zinc-900 dark:text-white">
                    {t.semester} ({t.section})
                  </div>
                  <div className="text-[11.5px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t.shift} Shift
                    </span>
                    <span>•</span>
                    <span>{t.slots.length} total slots</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      onSelectTimetable(t.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-[12px] font-medium flex items-center gap-1 transition-colors"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteTimetable(t.id)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Timetable"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[13px] font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
