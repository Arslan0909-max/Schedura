/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { WorkspaceCanvas } from './components/WorkspaceCanvas';
import { TemplatesModal } from './components/TemplatesModal';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';
import { TimetableData, TimetableSlot, ChatMessage, Conflict } from './types/timetable';
import { scanAllConflicts, checkSlotConflict } from './utils/conflictEngine';
import { voiceService } from './services/voiceService';
import { MessageSquare, Layout, Menu, Calendar, ChevronDown, Sparkles } from 'lucide-react';

export default function App() {
  // Application starts completely clean with NO pre-made timetables or fake data on load
  const [allTimetables, setAllTimetables] = useState<TimetableData[]>([]);
  const [activeTimetableId, setActiveTimetableId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);

  // Navigation & Modals
  const [activeNavTab, setActiveNavTab] = useState<'chat' | 'history' | 'templates' | 'settings'>('chat');
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Engine Settings
  const [strictConflict, setStrictConflict] = useState(true);
  const [autoRerouteRooms, setAutoRerouteRooms] = useState(true);

  // Mobile layout mode ('stacked' allows natural scrolling between chat on top & workspace below; 'tab' switches between them)
  const [mobileLayoutMode, setMobileLayoutMode] = useState<'stacked' | 'chat' | 'workspace'>('stacked');

  const mobileScrollContainerRef = useRef<HTMLDivElement>(null);
  const workspaceSectionRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLDivElement>(null);

  // Collapsible & Resizable Panel Layout State (Desktop)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('schedura_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('schedura_sidebar_width'));
      if (saved >= 180 && saved <= 360) return saved;
    } catch {}
    return 240;
  });

  const [chatWidth, setChatWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('schedura_chat_width'));
      if (saved >= 300 && saved <= 720) return saved;
    } catch {}
    return 440;
  });

  const [resizingPanel, setResizingPanel] = useState<'sidebar' | 'chat' | null>(null);

  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('schedura_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleStartResizeSidebar = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setResizingPanel('sidebar');
  }, []);

  const handleStartResizeChat = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setResizingPanel('chat');
  }, []);

  useEffect(() => {
    if (!resizingPanel) return;

    const handleMove = (clientX: number) => {
      if (resizingPanel === 'sidebar') {
        const newW = Math.max(180, Math.min(360, clientX));
        setSidebarWidth(newW);
        try {
          localStorage.setItem('schedura_sidebar_width', String(newW));
        } catch {}
      } else if (resizingPanel === 'chat') {
        const sidebarEffectiveWidth = isSidebarCollapsed ? 64 : sidebarWidth;
        const newChatW = Math.max(300, Math.min(720, clientX - sidebarEffectiveWidth));
        setChatWidth(newChatW);
        try {
          localStorage.setItem('schedura_chat_width', String(newChatW));
        } catch {}
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    const onEnd = () => {
      setResizingPanel(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onEnd);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingPanel, isSidebarCollapsed, sidebarWidth]);

  // Active Timetable derived object
  const activeTimetable = useMemo(() => {
    return allTimetables.find((t) => t.id === activeTimetableId) || null;
  }, [allTimetables, activeTimetableId]);

  // Global Memory: Flattened list of all slots across all semesters and sections
  const globalSlots = useMemo(() => {
    return allTimetables.flatMap((t) => t.slots);
  }, [allTimetables]);

  // Global Conflicts across all timetables
  const globalConflicts = useMemo(() => {
    return scanAllConflicts(globalSlots);
  }, [globalSlots]);

  const scrollToMobileWorkspace = useCallback(() => {
    if (workspaceSectionRef.current) {
      workspaceSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const scrollToMobileChat = useCallback(() => {
    if (chatSectionRef.current) {
      chatSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Handle rendering a timetable onto the live WorkSpace canvas
  const handleRenderToCanvas = useCallback(
    (data: Partial<TimetableData>) => {
      const id =
        data.id ||
        `timetable-${data.semester?.replace(/\s+/g, '-').toLowerCase()}-${data.section?.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

      const newTimetable: TimetableData = {
        id,
        semester: data.semester || 'Semester 1',
        section: data.section || 'Section A',
        shift: (data.shift as 'Morning' | 'Evening') || 'Morning',
        days: data.days && data.days.length > 0 ? data.days : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeSlots:
          data.timeSlots && data.timeSlots.length > 0
            ? data.timeSlots
            : [
                '08:30 - 09:30',
                '09:30 - 10:30',
                '10:30 - 11:30',
                '11:30 - 12:30',
                '12:30 - 01:30',
                '01:30 - 02:30',
              ],
        slots: data.slots || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setAllTimetables((prev) => {
        const existingIdx = prev.findIndex((t) => t.id === id);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = newTimetable;
          return updated;
        }
        return [...prev, newTimetable];
      });

      setActiveTimetableId(id);

      // On mobile devices, smoothly scroll down to the workspace section
      setTimeout(() => {
        scrollToMobileWorkspace();
      }, 250);
    },
    [scrollToMobileWorkspace]
  );

  // Load sample schedules
  const handleLoadSample = useCallback((type: 'CS' | 'BBA') => {
    if (type === 'CS') {
      handleRenderToCanvas({
        semester: 'BS Computer Science Sem 3',
        section: 'Section A',
        shift: 'Morning',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeSlots: ['08:30 - 09:30', '09:30 - 10:30', '10:30 - 11:30', '11:30 - 12:00', '12:00 - 01:00', '01:00 - 02:00'],
        slots: [
          { day: 'Monday', timeSlot: '08:30 - 09:30', subject: 'Data Structures & Algorithms', teacher: 'Dr. Tariq Khan', room: 'Lab 2', color: 'indigo', isBreak: false },
          { day: 'Monday', timeSlot: '09:30 - 10:30', subject: 'DSA Practical Lab', teacher: 'Dr. Tariq Khan', room: 'Lab 2', color: 'indigo', isBreak: false },
          { day: 'Monday', timeSlot: '10:30 - 11:30', subject: 'Linear Algebra', teacher: 'Prof. Sarah Ahmed', room: 'Room 102', color: 'blue', isBreak: false },
          { day: 'Monday', timeSlot: '11:30 - 12:00', subject: 'Lunch & Prayer Break', teacher: '', room: 'Campus Cafeteria', color: 'amber', isBreak: true },
          { day: 'Monday', timeSlot: '12:00 - 01:00', subject: 'Operating Systems', teacher: 'Engr. Bilal', room: 'Room 204', color: 'emerald', isBreak: false },
          { day: 'Tuesday', timeSlot: '08:30 - 09:30', subject: 'Database Systems', teacher: 'Dr. Ayesha Malik', room: 'Room 105', color: 'purple', isBreak: false },
          { day: 'Tuesday', timeSlot: '09:30 - 10:30', subject: 'Database Systems Lab', teacher: 'Dr. Ayesha Malik', room: 'Lab 1', color: 'purple', isBreak: false },
          { day: 'Tuesday', timeSlot: '11:30 - 12:00', subject: 'Break', teacher: '', room: '', color: 'amber', isBreak: true },
          { day: 'Wednesday', timeSlot: '08:30 - 09:30', subject: 'Data Structures', teacher: 'Dr. Tariq Khan', room: 'Lab 2', color: 'indigo', isBreak: false },
          { day: 'Wednesday', timeSlot: '10:30 - 11:30', subject: 'Operating Systems Lab', teacher: 'Engr. Bilal', room: 'Lab 3', color: 'emerald', isBreak: false },
          { day: 'Wednesday', timeSlot: '11:30 - 12:00', subject: 'Break', teacher: '', room: '', color: 'amber', isBreak: true },
          { day: 'Thursday', timeSlot: '08:30 - 09:30', subject: 'Technical Writing', teacher: 'Ms. Fatima', room: 'Room 101', color: 'rose', isBreak: false },
          { day: 'Thursday', timeSlot: '09:30 - 10:30', subject: 'Linear Algebra', teacher: 'Prof. Sarah Ahmed', room: 'Room 102', color: 'blue', isBreak: false },
          { day: 'Thursday', timeSlot: '11:30 - 12:00', subject: 'Break', teacher: '', room: '', color: 'amber', isBreak: true },
          { day: 'Friday', timeSlot: '08:30 - 09:30', subject: 'Database Systems', teacher: 'Dr. Ayesha Malik', room: 'Room 105', color: 'purple', isBreak: false },
          { day: 'Friday', timeSlot: '09:30 - 10:30', subject: 'Operating Systems', teacher: 'Engr. Bilal', room: 'Room 204', color: 'emerald', isBreak: false },
        ]
      });
    } else {
      handleRenderToCanvas({
        semester: 'BBA Semester 1',
        section: 'Section A',
        shift: 'Morning',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeSlots: ['08:30 - 09:30', '09:30 - 10:30', '10:30 - 11:30', '11:30 - 12:00', '12:00 - 01:00', '01:00 - 02:00'],
        slots: [
          { day: 'Monday', timeSlot: '08:30 - 09:30', subject: 'Principles of Management', teacher: 'Dr. Farhan Qureshi', room: 'Executive Hall 1', color: 'blue', isBreak: false },
          { day: 'Monday', timeSlot: '09:30 - 10:30', subject: 'Financial Accounting', teacher: 'Prof. Hina Shah', room: 'Room 301', color: 'emerald', isBreak: false },
          { day: 'Monday', timeSlot: '10:30 - 11:30', subject: 'Marketing Management', teacher: 'Dr. Usman Raza', room: 'Room 302', color: 'purple', isBreak: false },
          { day: 'Monday', timeSlot: '11:30 - 12:00', subject: 'Refreshment Break', teacher: '', room: 'Student Lounge', color: 'amber', isBreak: true },
          { day: 'Tuesday', timeSlot: '08:30 - 09:30', subject: 'Microeconomics', teacher: 'Dr. Kamran Ali', room: 'Room 303', color: 'indigo', isBreak: false },
          { day: 'Tuesday', timeSlot: '09:30 - 10:30', subject: 'Business Mathematics', teacher: 'Prof. Sarah Ahmed', room: 'Room 301', color: 'teal', isBreak: false },
          { day: 'Tuesday', timeSlot: '11:30 - 12:00', subject: 'Break', teacher: '', room: '', color: 'amber', isBreak: true },
          { day: 'Wednesday', timeSlot: '08:30 - 09:30', subject: 'Principles of Management', teacher: 'Dr. Farhan Qureshi', room: 'Executive Hall 1', color: 'blue', isBreak: false },
          { day: 'Wednesday', timeSlot: '09:30 - 10:30', subject: 'Financial Accounting Tutorial', teacher: 'Prof. Hina Shah', room: 'Room 301', color: 'emerald', isBreak: false },
          { day: 'Wednesday', timeSlot: '11:30 - 12:00', subject: 'Break', teacher: '', room: '', color: 'amber', isBreak: true },
          { day: 'Thursday', timeSlot: '08:30 - 09:30', subject: 'Marketing Workshop', teacher: 'Dr. Usman Raza', room: 'Seminar Hall', color: 'purple', isBreak: false },
          { day: 'Thursday', timeSlot: '10:30 - 11:30', subject: 'Microeconomics', teacher: 'Dr. Kamran Ali', room: 'Room 303', color: 'indigo', isBreak: false },
          { day: 'Thursday', timeSlot: '11:30 - 12:00', subject: 'Break', teacher: '', room: '', color: 'amber', isBreak: true },
          { day: 'Friday', timeSlot: '08:30 - 09:30', subject: 'Business Mathematics', teacher: 'Prof. Sarah Ahmed', room: 'Room 301', color: 'teal', isBreak: false },
        ]
      });
    }
  }, [handleRenderToCanvas]);

  // Send message to Schedura AI
  const handleSendMessage = async (text: string, isVoice = false) => {
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVoice,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    if (isVoice) {
      setIsVoiceProcessing(true);
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          globalMemory: globalSlots,
          currentTimetable: activeTimetable,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('API error status:', response.status, errorText.slice(0, 150));
        throw new Error(`Server returned status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const nonJsonText = await response.text();
        console.warn('Non-JSON response received:', nonJsonText.slice(0, 150));
        throw new Error('Non-JSON response received from server');
      }

      const data = await response.json();
      const assistantText = data.text || 'I have analyzed your request.';
      const timetableData = data.timetableData;

      let detectedConflicts: Conflict[] = [];

      // If timetable data was generated or updated:
      if (timetableData && (timetableData.slots || timetableData.semester)) {
        // Automatically render to live canvas!
        handleRenderToCanvas(timetableData);

        // Check for any potential conflicts against global memory
        const rawSlots = Array.isArray(timetableData.slots) ? timetableData.slots : [];
        const formattedSlots: TimetableSlot[] = rawSlots.map((s: any, i: number) => ({
          ...s,
          id: s.id || `slot-${Date.now()}-${i}`,
          semester: timetableData.semester,
          section: timetableData.section,
          shift: timetableData.shift || 'Morning',
        }));

        for (const s of formattedSlots) {
          const slotClashes = checkSlotConflict(s, globalSlots);
          if (slotClashes.length > 0) {
            detectedConflicts.push(...slotClashes);
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timetableData: timetableData || null,
        conflicts: detectedConflicts.length > 0 ? detectedConflicts : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If requested via voice or user spoke, speak the response naturally with emotional inflection
      if (isVoice) {
        voiceService.speakText(assistantText);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: 'assistant',
        content: `I'm on it! I encountered a brief network glitch, but you can continue typing or click a starter prompt below.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setIsVoiceProcessing(false);
    }
  };

  // Reset to clean new chat
  const handleNewChat = () => {
    setMessages([]);
    setActiveNavTab('chat');
  };

  // Nav selection
  const handleSelectNavTab = (tab: 'chat' | 'history' | 'templates' | 'settings') => {
    setActiveNavTab(tab);
    if (tab === 'templates') {
      setShowTemplatesModal(true);
    } else if (tab === 'history') {
      setShowHistoryModal(true);
    } else if (tab === 'settings') {
      setShowSettingsModal(true);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#F8F9FA] text-[#1D1D1F] overflow-hidden font-sans antialiased flex-col md:flex-row">
      {/* 1. Left Sidebar Navigation with Collapsible & Resizable Width + Mobile Drawer */}
      <Sidebar
        activeTab={activeNavTab}
        onSelectTab={handleSelectNavTab}
        onNewChat={handleNewChat}
        timetablesCount={allTimetables.length}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        width={sidebarWidth}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Resizer Handle: Sidebar <-> Chat (Only when sidebar is expanded on desktop) */}
      {!isSidebarCollapsed && (
        <div
          id="resize-handle-sidebar"
          onMouseDown={handleStartResizeSidebar}
          onTouchStart={handleStartResizeSidebar}
          className="hidden md:flex w-1 hover:w-1.5 bg-transparent hover:bg-zinc-300 active:bg-zinc-400 cursor-col-resize z-30 transition-all items-center justify-center group select-none shrink-0"
          title="Drag to resize sidebar"
        >
          <div className="w-0.5 h-8 rounded-full bg-zinc-300/80 group-hover:bg-zinc-500 transition-colors" />
        </div>
      )}

      {/* MOBILE TOP BAR (Visible only on < md screens) */}
      <div className="md:hidden flex items-center justify-between px-3.5 py-2.5 liquid-glass-subtle border-b border-zinc-200/80 z-30 shrink-0 select-none shadow-2xs">
        {/* Left: Mobile Sidebar Drawer Button & Logo */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="w-8.5 h-8.5 rounded-xl bg-zinc-100/90 hover:bg-zinc-200/90 flex items-center justify-center text-zinc-700 punch-tap transition-all"
            title="Open Menu"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>

          <div className="flex items-center gap-1.5">
            <div className="w-6.5 h-6.5 rounded-lg bg-black text-white flex items-center justify-center shadow-2xs">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-[15px] text-zinc-900 tracking-tight">Schedura</span>
            <span className="px-1 py-0.2 text-[9.5px] font-medium bg-zinc-200/70 text-zinc-800 rounded border border-zinc-200/80">
              AI
            </span>
          </div>
        </div>

        {/* Right: Quick Mobile/Tablet View Switcher (Assistant | WorkSpace | Stacked) */}
        <div className="flex items-center gap-1 bg-zinc-200/70 p-0.5 rounded-xl border border-zinc-200/80">
          <button
            type="button"
            onClick={() => {
              setMobileLayoutMode('chat');
              scrollToMobileChat();
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium punch-tap transition-all flex items-center gap-1 ${
              mobileLayoutMode === 'chat'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileLayoutMode('workspace');
              scrollToMobileWorkspace();
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium punch-tap transition-all flex items-center gap-1 ${
              mobileLayoutMode === 'workspace'
                ? 'bg-zinc-900 text-white shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Layout className="w-3 h-3" />
            <span>Canvas</span>
            {activeTimetable && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileLayoutMode('stacked');
            }}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium punch-tap transition-all ${
              mobileLayoutMode === 'stacked'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Stacked View"
          >
            <span>Both</span>
          </button>
        </div>
      </div>

      {/* MOBILE / TABLET VIEW */}
      <div
        ref={mobileScrollContainerRef}
        className="md:hidden flex-1 overflow-y-auto overflow-x-hidden flex flex-col bg-[#F8F9FA] divide-y divide-zinc-200/80"
      >
        {/* Mobile Section 1: AI Assistant Chat */}
        {(mobileLayoutMode === 'stacked' || mobileLayoutMode === 'chat') && (
          <div
            ref={chatSectionRef}
            id="mobile-chat-section"
            className={`${
              mobileLayoutMode === 'chat' ? 'h-full flex-1' : 'h-[58vh] min-h-[440px]'
            } flex flex-col bg-white shrink-0 animate-in fade-in duration-200`}
          >
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              isVoiceProcessing={isVoiceProcessing}
              onSendMessage={handleSendMessage}
              onRenderToCanvas={handleRenderToCanvas}
              activeTimetable={activeTimetable}
            />
          </div>
        )}

        {/* Mobile Section 2: WorkSpace Canvas */}
        {(mobileLayoutMode === 'stacked' || mobileLayoutMode === 'workspace') && (
          <div
            ref={workspaceSectionRef}
            id="mobile-workspace-section"
            className={`${
              mobileLayoutMode === 'workspace' ? 'h-full flex-1 min-h-screen' : 'min-h-[85vh]'
            } flex flex-col bg-[#FBFBFD] flex-1 pb-16 animate-in fade-in duration-200`}
          >
            {/* Scroll Down Indicator Header (Visible only in stacked mode) */}
            {mobileLayoutMode === 'stacked' && (
              <div className="px-4 py-2.5 liquid-glass-subtle border-b border-zinc-200/70 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-800">
                  <Layout className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Timetable WorkSpace Canvas</span>
                </div>
                <span className="text-[11px] text-zinc-500">Tap any cell to edit</span>
              </div>
            )}

            <WorkspaceCanvas
              activeTimetable={activeTimetable}
              allTimetables={allTimetables}
              isVoiceProcessing={isVoiceProcessing}
              onSelectTimetable={(id) => setActiveTimetableId(id)}
              onUpdateTimetable={(updated) => {
                setAllTimetables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
              }}
              onLoadSample={handleLoadSample}
              globalSlots={globalSlots}
              conflicts={globalConflicts}
            />
          </div>
        )}
      </div>

      {/* DESKTOP VIEW: Split Resizable Layout (Hidden on mobile, visible md+) */}
      {/* 2. Middle Conversational AI Assistant Panel ('Schedura') with Dynamic Drag-to-Resize */}
      <div
        style={{ width: `${chatWidth}px` }}
        className="hidden md:flex h-full shrink-0 flex-col"
      >
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          isVoiceProcessing={isVoiceProcessing}
          onSendMessage={handleSendMessage}
          onRenderToCanvas={handleRenderToCanvas}
          activeTimetable={activeTimetable}
        />
      </div>

      {/* Resizer Handle: Chat <-> Workspace Canvas */}
      <div
        id="resize-handle-chat-workspace"
        onMouseDown={handleStartResizeChat}
        onTouchStart={handleStartResizeChat}
        className="hidden md:flex w-1 hover:w-1.5 bg-transparent hover:bg-zinc-300 active:bg-zinc-400 cursor-col-resize z-30 transition-all items-center justify-center group select-none shrink-0"
        title="Drag to resize chat and workspace"
      >
        <div className="w-0.5 h-10 rounded-full bg-zinc-300/80 group-hover:bg-zinc-500 transition-colors" />
      </div>

      {/* 3. Right WorkSpace Canvas */}
      <div className="hidden md:flex h-full flex-1 min-w-0 flex-col">
        <WorkspaceCanvas
          activeTimetable={activeTimetable}
          allTimetables={allTimetables}
          isVoiceProcessing={isVoiceProcessing}
          onSelectTimetable={(id) => setActiveTimetableId(id)}
          onUpdateTimetable={(updated) => {
            setAllTimetables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          }}
          onLoadSample={handleLoadSample}
          globalSlots={globalSlots}
          conflicts={globalConflicts}
        />
      </div>

      {/* Dialog Modals */}
      <TemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onApplyTemplate={(tpl) => handleRenderToCanvas(tpl)}
      />

      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        timetables={allTimetables}
        onSelectTimetable={(id) => {
          setActiveTimetableId(id);
          setTimeout(() => scrollToMobileWorkspace(), 200);
        }}
        onDeleteTimetable={(id) => {
          setAllTimetables((prev) => prev.filter((t) => t.id !== id));
          if (activeTimetableId === id) {
            setActiveTimetableId(null);
          }
        }}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        strictConflict={strictConflict}
        setStrictConflict={setStrictConflict}
        autoRerouteRooms={autoRerouteRooms}
        setAutoRerouteRooms={setAutoRerouteRooms}
      />
    </div>
  );
}
