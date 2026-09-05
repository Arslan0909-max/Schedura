import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Check, Trash2 } from 'lucide-react';
import { TimetableSlot } from '../types/timetable';
import { UNIVERSITY_ROOMS, checkSlotConflict } from '../utils/conflictEngine';

interface SlotEditModalProps {
  slot: TimetableSlot | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSlot: TimetableSlot) => void;
  onDelete: (slotId: string) => void;
  globalSlots: TimetableSlot[];
  allDays: string[];
  allTimeSlots: string[];
}

export const SlotEditModal: React.FC<SlotEditModalProps> = ({
  slot,
  isOpen,
  onClose,
  onSave,
  onDelete,
  globalSlots,
  allDays,
  allTimeSlots,
}) => {
  if (!isOpen || !slot) return null;

  const [subject, setSubject] = useState(slot.subject);
  const [teacher, setTeacher] = useState(slot.teacher);
  const [room, setRoom] = useState(slot.room);
  const [day, setDay] = useState(slot.day);
  const [timeSlot, setTimeSlot] = useState(slot.timeSlot);
  const [isBreak, setIsBreak] = useState(Boolean(slot.isBreak));
  const [breakLabel, setBreakLabel] = useState(slot.breakLabel || 'Break & Prayer');
  const [color, setColor] = useState(slot.color || 'indigo');

  useEffect(() => {
    setSubject(slot.subject);
    setTeacher(slot.teacher);
    setRoom(slot.room);
    setDay(slot.day);
    setTimeSlot(slot.timeSlot);
    setIsBreak(Boolean(slot.isBreak));
    setBreakLabel(slot.breakLabel || 'Break & Prayer');
    setColor(slot.color || 'indigo');
  }, [slot]);

  // Real-time conflict preview against global memory
  const proposedSlot: TimetableSlot = {
    ...slot,
    subject,
    teacher,
    room,
    day,
    timeSlot,
    isBreak,
    breakLabel,
    color,
  };

  const currentConflicts = checkSlotConflict(proposedSlot, globalSlots, slot.id);

  const colors = [
    { name: 'indigo', label: 'Indigo', bg: 'bg-indigo-500' },
    { name: 'blue', label: 'Blue', bg: 'bg-blue-500' },
    { name: 'emerald', label: 'Emerald', bg: 'bg-emerald-500' },
    { name: 'amber', label: 'Amber', bg: 'bg-amber-500' },
    { name: 'rose', label: 'Rose', bg: 'bg-rose-500' },
    { name: 'purple', label: 'Purple', bg: 'bg-purple-500' },
    { name: 'teal', label: 'Teal', bg: 'bg-teal-500' },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(proposedSlot);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="slot-edit-modal"
        className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-zinc-200/80 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
          <div>
            <h3 className="text-[17px] font-semibold text-zinc-900">Edit Class Slot</h3>
            <p className="text-[12px] text-zinc-500">
              {slot.semester} • {slot.section}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Toggle Break */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
            <div>
              <div className="text-[13px] font-medium text-zinc-900">Mark as Break / Recess</div>
              <div className="text-[11px] text-zinc-500">Lunch, prayer, or assembly recess</div>
            </div>
            <button
              type="button"
              onClick={() => setIsBreak(!isBreak)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                isBreak ? 'bg-black' : 'bg-zinc-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  isBreak ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {isBreak ? (
            <div>
              <label className="block text-[12px] font-medium text-zinc-700 mb-1">Break Label</label>
              <input
                type="text"
                value={breakLabel}
                onChange={(e) => setBreakLabel(e.target.value)}
                placeholder="e.g. Lunch & Prayer Break"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-[13.5px] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400"
              />
            </div>
          ) : (
            <>
              {/* Subject */}
              <div>
                <label className="block text-[12px] font-medium text-zinc-700 mb-1">Subject / Course Title</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Financial Accounting"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-[13.5px] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400"
                />
              </div>

              {/* Teacher & Room in 2 columns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-zinc-700 mb-1">Teacher / Professor</label>
                  <input
                    type="text"
                    required
                    value={teacher}
                    onChange={(e) => setTeacher(e.target.value)}
                    placeholder="e.g. Dr. Tariq Khan"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white text-[13.5px] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-zinc-700 mb-1">Room / Hall</label>
                  <select
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400"
                  >
                    {UNIVERSITY_ROOMS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">Color Accent</label>
                <div className="flex items-center gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setColor(c.name)}
                      className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center transition-transform ${
                        color === c.name ? 'ring-2 ring-offset-2 ring-black scale-110' : 'hover:scale-105'
                      }`}
                    >
                      {color === c.name && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Day and Time slot selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700 mb-1">Day of Week</label>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400"
              >
                {allDays.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-zinc-700 mb-1">Time Slot</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400"
              >
                {allTimeSlots.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conflict warnings if any */}
          {currentConflicts.length > 0 && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-[12px] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Conflict Detected in Global Memory!</span>
              </div>
              {currentConflicts.map((c, i) => (
                <p key={i} className="text-[11.5px] leading-tight">
                  {c.description}
                </p>
              ))}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => {
                if (confirm('Remove this class slot from schedule?')) {
                  onDelete(slot.id);
                  onClose();
                }
              }}
              className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-[13px] font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-[13px] font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-black hover:bg-zinc-800 text-white text-[13px] font-medium transition-transform active:scale-95 shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
