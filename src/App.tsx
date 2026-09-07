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
import { MemoryModal } from './components/MemoryModal';
import { AuthModal } from './components/AuthModal';
import { TimetableData, TimetableSlot, ChatMessage, Conflict } from './types/timetable';
import { scanAllConflicts, checkSlotConflict } from './utils/conflictEngine';
import { voiceService } from './services/voiceService';
import { memoryService } from './services/memoryService';
import { sendClientGeminiMessage } from './services/clientGeminiService';
import {
  AppUser,
  subscribeToAuthState,
  saveTimetableToFirestore,
  loadTimetablesFromFirestore,
  deleteTimetableFromFirestore,
  saveChatMessagesToFirestore,
  loadChatMessagesFromFirestore
} from './services/firebase';
import { MessageSquare, Layout, Menu, Calendar, ChevronDown, Sparkles, Moon, Sun } from 'lucide-react';

export default function App() {
  // Application starts with local cached or cloud restored timetables
  const [allTimetables, setAllTimetables] = useState<TimetableData[]>(() => {
    try {
      const saved = localStorage.getItem('schedura_timetables');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [activeTimetableId, setActiveTimetableId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('schedura_active_timetable_id');
    } catch {}
    return null;
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('schedura_chat_messages');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Navigation & Modals
  const [activeNavTab, setActiveNavTab] = useState<'chat' | 'history' | 'templates' | 'settings'>('chat');
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [memoryCount, setMemoryCount] = useState(() => memoryService.getAll().length);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Persist timetables to localStorage & Firestore whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('schedura_timetables', JSON.stringify(allTimetables));
      if (activeTimetableId) {
        localStorage.setItem('schedura_active_timetable_id', activeTimetableId);
      }
    } catch {}
  }, [allTimetables, activeTimetableId]);

  // Persist chat messages to localStorage & Firestore whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('schedura_chat_messages', JSON.stringify(messages));
    } catch {}
    if (currentUser?.uid && messages.length > 0) {
      saveChatMessagesToFirestore(messages, currentUser.uid);
    }
  }, [messages, currentUser]);

  // Firebase Auth Listener & Cloud Sync on Login / Page Reload / Sign Out
  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (user) => {
      setCurrentUser(user);
      if (user?.uid) {
        // Authenticated: Load user's cloud memories, timetables and chats
        await memoryService.syncWithFirestore(user.uid);
        setMemoryCount(memoryService.getAll().length);

        // Load user's cloud timetables
        try {
          const cloudTimetables = await loadTimetablesFromFirestore(user.uid);
          if (cloudTimetables && cloudTimetables.length > 0) {
            setAllTimetables(cloudTimetables);
            setActiveTimetableId(cloudTimetables[cloudTimetables.length - 1].id);
          } else {
            setAllTimetables([]);
            setActiveTimetableId(null);
          }
        } catch (e) {
          console.warn('Failed loading cloud timetables:', e);
        }

        // Load user's cloud chat messages
        try {
          const cloudChats = await loadChatMessagesFromFirestore(user.uid);
          if (cloudChats && cloudChats.length > 0) {
            setMessages(cloudChats);
          } else {
            setMessages([]);
          }
        } catch (e) {
          console.warn('Failed loading cloud chats:', e);
        }
      } else {
        // Logged Out / Signed Out: Everything is completely fresh & clean!
        memoryService.handleUserLogout();
        setMemoryCount(0);
        setAllTimetables([]);
        setActiveTimetableId(null);
        setMessages([]);
        try {
          localStorage.removeItem('schedura_timetables');
          localStorage.removeItem('schedura_active_timetable_id');
          localStorage.removeItem('schedura_chat_messages');
        } catch {}
      }
    });

    return () => unsubscribe();
  }, []);

  // Dark Mode State & Synchronization
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('schedura_theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('schedura_theme', next ? 'dark' : 'light');
      } catch {}
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: currentUser?.uid || 'local',
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

      // Save to Firestore cloud database
      saveTimetableToFirestore(newTimetable, currentUser?.uid);

      // Save to AI persistent project memory for future cross-project awareness
      memoryService.autoRecordProjectMemory(newTimetable);
      if (currentUser?.uid) {
        memoryService.syncWithFirestore(currentUser.uid);
      }
      setMemoryCount(memoryService.getAll().length);

      setActiveTimetableId(id);

      // On mobile devices, smoothly scroll down to the workspace section
      setTimeout(() => {
        scrollToMobileWorkspace();
      }, 250);
    },
    [currentUser, scrollToMobileWorkspace]
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

    // Auto learn persistent memories from conversational patterns
    memoryService.autoLearnFromConversation(text);
    if (currentUser?.uid) {
      memoryService.syncWithFirestore(currentUser.uid);
    }
    setMemoryCount(memoryService.getAll().length);

    setMessages((prev) => [...prev, userMsg]);

    // Instant In-App Agentic UI Command Processor
    const lowerText = text.toLowerCase().trim();
    const isLiveOff = (lowerText.includes('live') || lowerText.includes('voice')) && (lowerText.includes('off') || lowerText.includes('bnd') || lowerText.includes('stop') || lowerText.includes('close') || lowerText.includes('band'));
    const isDarkModeOn = lowerText.includes('dark') && (lowerText.includes('on') || lowerText.includes('enable') || lowerText.includes('switch') || lowerText.includes('theme') || lowerText.includes('karo'));
    const isLightModeOn = lowerText.includes('light') && (lowerText.includes('on') || lowerText.includes('enable') || lowerText.includes('theme') || lowerText.includes('karo'));
    const isOpenTemplates = lowerText.includes('template') && (lowerText.includes('open') || lowerText.includes('show') || lowerText.includes('dikhao'));
    const isOpenSettings = lowerText.includes('setting') && (lowerText.includes('open') || lowerText.includes('show') || lowerText.includes('dikhao'));
    const isOpenHistory = lowerText.includes('history') && (lowerText.includes('open') || lowerText.includes('show') || lowerText.includes('dikhao'));
    const isOpenMemory = lowerText.includes('memory') && (lowerText.includes('open') || lowerText.includes('show') || lowerText.includes('dikhao'));
    const isOpenAuth = (lowerText.includes('login') || lowerText.includes('account')) && (lowerText.includes('open') || lowerText.includes('show'));
    const isCloseModal = (lowerText.includes('close') || lowerText.includes('bnd')) && (lowerText.includes('modal') || lowerText.includes('window') || lowerText.includes('dialog'));
    const isToggleSidebar = (lowerText.includes('sidebar') || lowerText.includes('menu')) && (lowerText.includes('toggle') || lowerText.includes('open') || lowerText.includes('close') || lowerText.includes('collapse') || lowerText.includes('expand'));
    const isSwitchCanvas = lowerText.includes('canvas') && (lowerText.includes('switch') || lowerText.includes('show') || lowerText.includes('view') || lowerText.includes('dikhao'));
    const isNewChat = (lowerText.includes('new chat') || lowerText.includes('clear chat') || lowerText.includes('reset chat')) && !lowerText.includes('timetable');
    const isLoadSample = lowerText.includes('sample') && (lowerText.includes('load') || lowerText.includes('generate') || lowerText.includes('timetable'));

    if (isLiveOff || isDarkModeOn || isLightModeOn || isOpenTemplates || isOpenSettings || isOpenHistory || isOpenMemory || isOpenAuth || isCloseModal || isToggleSidebar || isSwitchCanvas || isNewChat || isLoadSample) {
      let replyText = "Agentic UI action completed.";
      if (isLiveOff) {
        voiceService.stopLiveVoiceMode();
        replyText = "Live Voice Mode has been disabled.";
      } else if (isDarkModeOn) {
        setIsDarkMode(true);
        replyText = "Switched to Dark Mode.";
      } else if (isLightModeOn) {
        setIsDarkMode(false);
        replyText = "Switched to Light Mode.";
      } else if (isOpenTemplates) {
        setShowTemplatesModal(true);
        replyText = "Opened Timetable Templates.";
      } else if (isOpenSettings) {
        setShowSettingsModal(true);
        replyText = "Opened Engine Settings.";
      } else if (isOpenHistory) {
        setShowHistoryModal(true);
        replyText = "Opened Timetable History.";
      } else if (isOpenMemory) {
        setShowMemoryModal(true);
        replyText = "Opened Permanent Memory.";
      } else if (isOpenAuth) {
        setShowAuthModal(true);
        replyText = "Opened User Authentication.";
      } else if (isCloseModal) {
        setShowTemplatesModal(false);
        setShowSettingsModal(false);
        setShowHistoryModal(false);
        setShowMemoryModal(false);
        setShowAuthModal(false);
        replyText = "Closed all modal dialogs.";
      } else if (isToggleSidebar) {
        handleToggleSidebarCollapse();
        replyText = "Toggled navigation sidebar.";
      } else if (isSwitchCanvas) {
        setMobileLayoutMode('workspace');
        replyText = "Switched view to Workspace Canvas.";
      } else if (isNewChat) {
        handleNewChat();
        replyText = "Started a fresh conversation.";
      } else if (isLoadSample) {
        handleLoadSample(lowerText.includes('bscs') ? 'bscs' : 'bba');
        replyText = "Loaded sample university timetable onto the canvas.";
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
      setIsVoiceProcessing(false);

      if (isVoice) {
        voiceService.speakText(replyText);
      }
      return;
    }

    setIsLoading(true);
    if (isVoice) {
      setIsVoiceProcessing(true);
    }

    const processAgenticAction = (agenticAction: any) => {
      if (!agenticAction) return;
      const { actionType, targetModal, targetView, sampleType, slotData } = agenticAction;

      if (actionType === 'turn_off_live_mode') voiceService.stopLiveVoiceMode();
      else if (actionType === 'toggle_dark_mode') setIsDarkMode((prev) => !prev);
      else if (actionType === 'set_dark_mode') setIsDarkMode(true);
      else if (actionType === 'set_light_mode') setIsDarkMode(false);
      else if (actionType === 'open_modal') {
        if (targetModal === 'templates') setShowTemplatesModal(true);
        else if (targetModal === 'history') setShowHistoryModal(true);
        else if (targetModal === 'settings') setShowSettingsModal(true);
        else if (targetModal === 'memory') setShowMemoryModal(true);
        else if (targetModal === 'auth') setShowAuthModal(true);
      } else if (actionType === 'toggle_sidebar') handleToggleSidebarCollapse();
      else if (actionType === 'switch_view') {
        if (targetView === 'workspace') setMobileLayoutMode('workspace');
        else if (targetView === 'chat') setMobileLayoutMode('chat');
      } else if (actionType === 'clear_chat') handleNewChat();
      else if (actionType === 'load_sample') handleLoadSample(sampleType || 'bba');
      else if (actionType === 'clear_canvas') {
        if (activeTimetable) {
          handleRenderToCanvas({ ...activeTimetable, slots: [] });
        }
      } else if (actionType === 'delete_slot') {
        if (activeTimetable && slotData) {
          const updatedSlots = activeTimetable.slots.filter(
            (s) => !(s.id === slotData.slotId || (s.day === slotData.day && s.timeSlot === slotData.timeSlot))
          );
          handleRenderToCanvas({ ...activeTimetable, slots: updatedSlots });
        }
      } else if (actionType === 'edit_slot' || actionType === 'add_slot') {
        if (activeTimetable && slotData) {
          const existingIdx = activeTimetable.slots.findIndex(
            (s) => s.id === slotData.slotId || (s.day === slotData.day && s.timeSlot === slotData.timeSlot)
          );
          let newSlots = [...activeTimetable.slots];
          const slotItem: TimetableSlot = {
            id: slotData.slotId || `slot-${Date.now()}`,
            day: slotData.day,
            timeSlot: slotData.timeSlot,
            subject: slotData.subject,
            teacher: slotData.teacher,
            room: slotData.room,
            isBreak: slotData.isBreak || false,
            breakLabel: slotData.breakLabel,
            color: slotData.color || 'blue',
            semester: activeTimetable.semester,
            section: activeTimetable.section,
            shift: activeTimetable.shift,
          };
          if (existingIdx >= 0) {
            newSlots[existingIdx] = { ...newSlots[existingIdx], ...slotItem };
          } else {
            newSlots.push(slotItem);
          }
          handleRenderToCanvas({ ...activeTimetable, slots: newSlots });
        }
      } else if (actionType === 'save_version') {
        if (activeTimetable) {
          handleRenderToCanvas(activeTimetable);
        }
      }
    };

    try {
      let assistantText = '';
      let timetableData: any = null;

      // Try Express backend first
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
            globalMemory: globalSlots,
            persistentMemories: memoryService.getAll(),
            allTimetables: allTimetables,
            currentTimetable: activeTimetable,
          }),
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            assistantText = data.text || '';
            timetableData = data.timetableData || null;

            if (data.agenticAction) {
              processAgenticAction(data.agenticAction);
            }
          } else {
            throw new Error('Non-JSON response from server');
          }
        } else {
          throw new Error(`Server status ${response.status}`);
        }
      } catch (backendErr) {
        console.info('Express backend unavailable or failed. Switching to Direct Client Gemini Engine:', backendErr);
        // Fallback to Direct Client-side Gemini API call!
        const clientRes = await sendClientGeminiMessage({
          message: text,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          globalMemory: globalSlots,
          persistentMemories: memoryService.getAll(),
          allTimetables: allTimetables,
          currentTimetable: activeTimetable,
        });
        assistantText = clientRes.text;
        timetableData = clientRes.timetableData;
        if (clientRes.agenticAction) {
          processAgenticAction(clientRes.agenticAction);
        }
      }

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
        content: assistantText || 'I have processed your timetable request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timetableData: timetableData || null,
        conflicts: detectedConflicts.length > 0 ? detectedConflicts : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Speak response if voice was used
      if (isVoice) {
        voiceService.speakText(assistantText);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      let errorContent = `I encountered an issue connecting to Gemini AI.`;
      if (err.message === 'MISSING_API_KEY') {
        errorContent = `🔑 **Gemini API Key Required**: Please click **Settings (⚙️)** in the sidebar and enter your free Gemini API Key (from \`aistudio.google.com\`) to activate AI timetable generation on this hosted site!`;
      } else if (err.message) {
        errorContent += ` Detail: ${err.message}`;
      }

      const errorMsg: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: 'assistant',
        content: errorContent,
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
    setActiveTimetableId(null);
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
    <div className="flex h-screen w-screen bg-[#F8F9FA] dark:bg-[#0D0E12] text-[#1D1D1F] dark:text-[#EDEDEE] overflow-hidden font-sans antialiased flex-col md:flex-row">
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
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        currentUser={currentUser}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onOpenMemoryModal={() => setShowMemoryModal(true)}
        memoryCount={memoryCount}
      />

      {/* Resizer Handle: Sidebar <-> Chat (Only when sidebar is expanded on desktop) */}
      {!isSidebarCollapsed && (
        <div
          id="resize-handle-sidebar"
          onMouseDown={handleStartResizeSidebar}
          onTouchStart={handleStartResizeSidebar}
          className="hidden md:flex w-1 hover:w-1.5 bg-transparent hover:bg-zinc-300 dark:hover:bg-zinc-700 active:bg-zinc-400 dark:active:bg-zinc-600 cursor-col-resize z-30 transition-all items-center justify-center group select-none shrink-0"
          title="Drag to resize sidebar"
        >
          <div className="w-0.5 h-8 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80 group-hover:bg-zinc-500 dark:group-hover:bg-zinc-400 transition-colors" />
        </div>
      )}

      {/* MOBILE TOP BAR (Visible only on < md screens) */}
      <div className="md:hidden flex items-center justify-between px-3.5 py-2.5 liquid-glass-subtle border-b border-zinc-200/80 dark:border-zinc-800 z-30 shrink-0 select-none shadow-2xs">
        {/* Left: Mobile Sidebar Drawer Button & Logo */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="w-8.5 h-8.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-800 hover:bg-zinc-200/90 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 punch-tap transition-all"
            title="Open Menu"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>

          <div className="flex items-center gap-1.5">
            <div className="w-6.5 h-6.5 rounded-lg bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-2xs">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-[15px] text-zinc-900 dark:text-white tracking-tight">Schedura</span>
            <span className="px-1 py-0.2 text-[9.5px] font-medium bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded border border-zinc-200/80 dark:border-zinc-700">
              AI
            </span>
          </div>
        </div>

        {/* Right: Quick Dark Mode Toggle & Mobile/Tablet View Switcher */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="w-8 h-8 rounded-xl bg-zinc-100/90 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white punch-tap transition-all"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
          </button>

          <div className="flex items-center gap-1 bg-zinc-200/70 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => {
                setMobileLayoutMode('chat');
                scrollToMobileChat();
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium punch-tap transition-all flex items-center gap-1 ${
                mobileLayoutMode === 'chat'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
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
                  ? 'bg-zinc-900 dark:bg-zinc-700 text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
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
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Stacked View"
            >
              <span>Both</span>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE / TABLET VIEW */}
      <div
        ref={mobileScrollContainerRef}
        className="md:hidden flex-1 overflow-y-auto overflow-x-hidden flex flex-col bg-[#F8F9FA] dark:bg-[#0D0E12] divide-y divide-zinc-200/80 dark:divide-zinc-800"
      >
        {/* Mobile Section 1: AI Assistant Chat */}
        {(mobileLayoutMode === 'stacked' || mobileLayoutMode === 'chat') && (
          <div
            ref={chatSectionRef}
            id="mobile-chat-section"
            className={`${
              mobileLayoutMode === 'chat' ? 'h-full flex-1' : 'h-[58vh] min-h-[440px]'
            } flex flex-col bg-white dark:bg-[#121318] shrink-0 animate-in fade-in duration-200`}
          >
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              isVoiceProcessing={isVoiceProcessing}
              onSendMessage={handleSendMessage}
              onRenderToCanvas={handleRenderToCanvas}
              activeTimetable={activeTimetable}
              onOpenMemoryModal={() => setShowMemoryModal(true)}
              memoryCount={memoryCount}
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
            } flex flex-col bg-[#FBFBFD] dark:bg-[#0E0F14] flex-1 pb-16 animate-in fade-in duration-200`}
          >
            {/* Scroll Down Indicator Header (Visible only in stacked mode) */}
            {mobileLayoutMode === 'stacked' && (
              <div className="px-4 py-2.5 liquid-glass-subtle border-b border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-800 dark:text-zinc-200">
                  <Layout className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  <span>Timetable WorkSpace Canvas</span>
                </div>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Tap any cell to edit</span>
              </div>
            )}

            <WorkspaceCanvas
              activeTimetable={activeTimetable}
              allTimetables={allTimetables}
              isVoiceProcessing={isVoiceProcessing}
              isLoading={isLoading}
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
          onOpenMemoryModal={() => setShowMemoryModal(true)}
          memoryCount={memoryCount}
        />
      </div>

      {/* Resizer Handle: Chat <-> Workspace Canvas */}
      <div
        id="resize-handle-chat-workspace"
        onMouseDown={handleStartResizeChat}
        onTouchStart={handleStartResizeChat}
        className="hidden md:flex w-1 hover:w-1.5 bg-transparent hover:bg-zinc-300 dark:hover:bg-zinc-700 active:bg-zinc-400 dark:active:bg-zinc-600 cursor-col-resize z-30 transition-all items-center justify-center group select-none shrink-0"
        title="Drag to resize chat and workspace"
      >
        <div className="w-0.5 h-10 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80 group-hover:bg-zinc-500 dark:group-hover:bg-zinc-400 transition-colors" />
      </div>

      {/* 3. Right WorkSpace Canvas */}
      <div className="hidden md:flex h-full flex-1 min-w-0 flex-col">
        <WorkspaceCanvas
          activeTimetable={activeTimetable}
          allTimetables={allTimetables}
          isVoiceProcessing={isVoiceProcessing}
          isLoading={isLoading}
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
          deleteTimetableFromFirestore(id);
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
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <MemoryModal
        isOpen={showMemoryModal}
        onClose={() => setShowMemoryModal(false)}
        onMemoryUpdated={() => setMemoryCount(memoryService.getAll().length)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentUser={currentUser}
        savedTimetablesCount={allTimetables.length}
        savedMessagesCount={messages.length}
      />
    </div>
  );
}
