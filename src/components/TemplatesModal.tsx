import React from 'react';
import { X, Calendar, Sparkles, Check, ArrowRight } from 'lucide-react';
import { TimetableData } from '../types/timetable';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (timetable: TimetableData) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onApplyTemplate,
}) => {
  if (!isOpen) return null;

  const templates: Array<{
    name: string;
    program: string;
    semester: string;
    section: string;
    shift: 'Morning' | 'Evening';
    description: string;
    stats: string;
    data: TimetableData;
  }> = [
    {
      name: 'BBA Semester 1 (Section A)',
      program: 'Bachelor of Business Administration',
      semester: 'BBA Semester 1',
      section: 'Section A',
      shift: 'Morning',
      description: 'Standard 5-day university business curriculum with lunch and prayer recess.',
      stats: '6 Subjects • 5 Rooms • 0 Clashes',
      data: {
        id: 'template-bba-1a',
        semester: 'BBA Semester 1',
        section: 'Section A',
        shift: 'Morning',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeSlots: [
          '08:30 - 09:30',
          '09:30 - 10:30',
          '10:30 - 11:30',
          '11:30 - 12:00',
          '12:00 - 01:00',
          '01:00 - 02:00',
        ],
        slots: [
          { id: 'bba-1', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '08:30 - 09:30', subject: 'Financial Accounting', teacher: 'Dr. Tariq Khan', room: 'R-11', color: 'indigo' },
          { id: 'bba-2', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '09:30 - 10:30', subject: 'Business Mathematics', teacher: 'Prof. Sarah Ahmed', room: 'R-13', color: 'blue' },
          { id: 'bba-3', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '10:30 - 11:30', subject: 'Principles of Management', teacher: 'Dr. Bilal Qureshi', room: 'R-11', color: 'emerald' },
          { id: 'bba-4', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '11:30 - 12:00', subject: 'Break & Prayer', teacher: '', room: 'Campus Commons', isBreak: true, breakLabel: 'Morning Break & Prayer' },
          { id: 'bba-5', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '12:00 - 01:00', subject: 'Business Communication', teacher: 'Ms. Ayesha Siddiqui', room: 'R-12', color: 'purple' },
          { id: 'bba-6', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '01:00 - 02:00', subject: 'Microeconomics', teacher: 'Dr. Usman Farooq', room: 'R-14', color: 'amber' },

          { id: 'bba-7', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Tuesday', timeSlot: '08:30 - 09:30', subject: 'Business Communication', teacher: 'Ms. Ayesha Siddiqui', room: 'R-12', color: 'purple' },
          { id: 'bba-8', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Tuesday', timeSlot: '09:30 - 10:30', subject: 'IT in Business & Lab', teacher: 'Engr. Hamza Ali', room: 'Lab-02', color: 'teal' },
          { id: 'bba-9', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Tuesday', timeSlot: '10:30 - 11:30', subject: 'IT in Business & Lab', teacher: 'Engr. Hamza Ali', room: 'Lab-02', color: 'teal' },
          { id: 'bba-10', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Tuesday', timeSlot: '11:30 - 12:00', subject: 'Break & Prayer', teacher: '', room: 'Campus Commons', isBreak: true, breakLabel: 'Morning Break & Prayer' },
          { id: 'bba-11', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Tuesday', timeSlot: '12:00 - 01:00', subject: 'Financial Accounting', teacher: 'Dr. Tariq Khan', room: 'R-11', color: 'indigo' },

          { id: 'bba-12', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Wednesday', timeSlot: '08:30 - 09:30', subject: 'Principles of Management', teacher: 'Dr. Bilal Qureshi', room: 'R-11', color: 'emerald' },
          { id: 'bba-13', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Wednesday', timeSlot: '09:30 - 10:30', subject: 'Microeconomics', teacher: 'Dr. Usman Farooq', room: 'R-14', color: 'amber' },
          { id: 'bba-14', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Wednesday', timeSlot: '10:30 - 11:30', subject: 'Business Mathematics', teacher: 'Prof. Sarah Ahmed', room: 'R-13', color: 'blue' },
          { id: 'bba-15', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Wednesday', timeSlot: '11:30 - 12:00', subject: 'Break & Prayer', teacher: '', room: 'Campus Commons', isBreak: true, breakLabel: 'Morning Break & Prayer' },

          { id: 'bba-16', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Thursday', timeSlot: '08:30 - 09:30', subject: 'Financial Accounting', teacher: 'Dr. Tariq Khan', room: 'R-11', color: 'indigo' },
          { id: 'bba-17', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Thursday', timeSlot: '09:30 - 10:30', subject: 'Business Communication', teacher: 'Ms. Ayesha Siddiqui', room: 'R-12', color: 'purple' },
          { id: 'bba-18', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Thursday', timeSlot: '11:30 - 12:00', subject: 'Break & Prayer', teacher: '', room: 'Campus Commons', isBreak: true, breakLabel: 'Morning Break & Prayer' },
          { id: 'bba-19', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Thursday', timeSlot: '12:00 - 01:00', subject: 'Principles of Management', teacher: 'Dr. Bilal Qureshi', room: 'R-11', color: 'emerald' },

          { id: 'bba-20', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Friday', timeSlot: '08:30 - 09:30', subject: 'Business Mathematics', teacher: 'Prof. Sarah Ahmed', room: 'R-13', color: 'blue' },
          { id: 'bba-21', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Friday', timeSlot: '09:30 - 10:30', subject: 'Microeconomics', teacher: 'Dr. Usman Farooq', room: 'R-14', color: 'amber' },
          { id: 'bba-22', semester: 'BBA Semester 1', section: 'Section A', shift: 'Morning', day: 'Friday', timeSlot: '11:30 - 12:00', subject: 'Jummah & Lunch Break', teacher: '', room: 'Campus Commons', isBreak: true, breakLabel: 'Friday Prayer & Lunch' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    {
      name: 'BBA Semester 1 (Section B)',
      program: 'Bachelor of Business Administration',
      semester: 'BBA Semester 1',
      section: 'Section B',
      shift: 'Morning',
      description: 'Section B parallel schedule without room clashes with Section A.',
      stats: '6 Subjects • Non-overlapping Rooms',
      data: {
        id: 'template-bba-1b',
        semester: 'BBA Semester 1',
        section: 'Section B',
        shift: 'Morning',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeSlots: [
          '08:30 - 09:30',
          '09:30 - 10:30',
          '10:30 - 11:30',
          '11:30 - 12:00',
          '12:00 - 01:00',
          '01:00 - 02:00',
        ],
        slots: [
          { id: 'bba-b1', semester: 'BBA Semester 1', section: 'Section B', shift: 'Morning', day: 'Monday', timeSlot: '08:30 - 09:30', subject: 'Business Communication', teacher: 'Ms. Hira Salman', room: 'R-15', color: 'purple' },
          { id: 'bba-b2', semester: 'BBA Semester 1', section: 'Section B', shift: 'Morning', day: 'Monday', timeSlot: '09:30 - 10:30', subject: 'Financial Accounting', teacher: 'Dr. Tariq Khan', room: 'R-12', color: 'indigo' },
          { id: 'bba-b3', semester: 'BBA Semester 1', section: 'Section B', shift: 'Morning', day: 'Monday', timeSlot: '10:30 - 11:30', subject: 'Microeconomics', teacher: 'Dr. Usman Farooq', room: 'R-16', color: 'amber' },
          { id: 'bba-b4', semester: 'BBA Semester 1', section: 'Section B', shift: 'Morning', day: 'Monday', timeSlot: '11:30 - 12:00', subject: 'Break & Prayer', teacher: '', room: 'Campus Commons', isBreak: true, breakLabel: 'Morning Break & Prayer' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    {
      name: 'BS Computer Science (Sem 3)',
      program: 'BS Computer Science',
      semester: 'BSCS Semester 3',
      section: 'Section A',
      shift: 'Morning',
      description: 'Data Structures, Computer Architecture, Discrete Math & Dedicated Lab slots.',
      stats: '5 Subjects • 2 Lab Blocks • R-17, Lab-01',
      data: {
        id: 'template-bscs-3a',
        semester: 'BSCS Semester 3',
        section: 'Section A',
        shift: 'Morning',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeSlots: [
          '08:30 - 09:30',
          '09:30 - 10:30',
          '10:30 - 11:30',
          '11:30 - 12:00',
          '12:00 - 01:00',
          '01:00 - 02:00',
        ],
        slots: [
          { id: 'cs-1', semester: 'BSCS Semester 3', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '08:30 - 09:30', subject: 'Data Structures & Algorithms', teacher: 'Dr. Zeeshan Ali', room: 'R-17', color: 'indigo' },
          { id: 'cs-2', semester: 'BSCS Semester 3', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '09:30 - 10:30', subject: 'DSA Lab (Group 1)', teacher: 'Engr. Sana Malik', room: 'Lab-01', color: 'blue' },
          { id: 'cs-3', semester: 'BSCS Semester 3', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '10:30 - 11:30', subject: 'DSA Lab (Group 1)', teacher: 'Engr. Sana Malik', room: 'Lab-01', color: 'blue' },
          { id: 'cs-4', semester: 'BSCS Semester 3', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '11:30 - 12:00', subject: 'Break', teacher: '', room: '', isBreak: true, breakLabel: 'Morning Break' },
          { id: 'cs-5', semester: 'BSCS Semester 3', section: 'Section A', shift: 'Morning', day: 'Monday', timeSlot: '12:00 - 01:00', subject: 'Discrete Structures', teacher: 'Dr. Rehan Ahmed', room: 'R-17', color: 'rose' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white/95 dark:bg-[#18191E]/95 backdrop-blur-2xl border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white border border-zinc-200/60 dark:border-zinc-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white">University Timetable Templates</h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Load a verified conflict-free starter structure directly to WorkSpace
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {templates.map((tpl, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-[#1F2028] hover:bg-zinc-50/60 dark:hover:bg-zinc-800/60 transition-all duration-150 flex items-center justify-between group"
            >
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-[14.5px] font-semibold text-zinc-900 dark:text-white">{tpl.name}</h4>
                  <span className="px-2 py-0.5 text-[10.5px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md border border-zinc-200/60 dark:border-zinc-700">
                    {tpl.shift}
                  </span>
                </div>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{tpl.description}</p>
                <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>{tpl.stats}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onApplyTemplate(tpl.data);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-[12.5px] font-medium transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 shadow-xs"
              >
                <span>Load into Canvas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[12px] text-zinc-500 dark:text-zinc-400">
          <span>Templates are loaded into global anti-clash memory.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
