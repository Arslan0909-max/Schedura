import React from 'react';
import {
  SquarePen,
  History,
  LayoutGrid,
  Calendar,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Moon,
  Sun,
  Brain,
  Sparkles,
  User,
  ShieldCheck,
  LogIn,
} from 'lucide-react';
import { AppUser } from '../services/firebase';

interface SidebarProps {
  activeTab: 'chat' | 'history' | 'templates' | 'settings';
  onSelectTab: (tab: 'chat' | 'history' | 'templates' | 'settings') => void;
  onNewChat: () => void;
  timetablesCount: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  currentUser?: AppUser | null;
  onOpenAuthModal?: () => void;
  onOpenMemoryModal?: () => void;
  memoryCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onNewChat,
  timetablesCount,
  isCollapsed = false,
  onToggleCollapse,
  width = 250,
  isMobileOpen = false,
  onCloseMobile,
  isDarkMode = false,
  onToggleDarkMode,
  currentUser = null,
  onOpenAuthModal,
  onOpenMemoryModal,
  memoryCount = 0,
}) => {
  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        />
      )}

      <aside
        id="schedura-sidebar"
        style={{ width: isCollapsed ? 64 : `${width}px` }}
        className={`liquid-glass-subtle border-r border-zinc-200/70 dark:border-zinc-800 flex flex-col justify-between select-none shrink-0 transition-all duration-200 overflow-hidden relative ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-250 flex'
            : 'hidden md:flex h-full'
        }`}
      >
        {/* Top Header & Brand */}
        <div className={isCollapsed && !isMobileOpen ? 'p-2' : 'p-4'}>
          <div
            className={`flex items-center ${
              isCollapsed && !isMobileOpen
                ? 'justify-center mb-4 pt-1'
                : 'justify-between mb-5 px-1'
            }`}
          >
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black dark:bg-zinc-800 flex items-center justify-center text-white shadow-sm shadow-black/20 shrink-0 punch-tap">
                  <Calendar className="w-4.5 h-4.5" />
                </div>
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="font-semibold text-[17px] tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                    Schedura
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-md border border-zinc-200/80 dark:border-zinc-700 shrink-0">
                    AI
                  </span>
                </div>
              </div>
            )}

            {/* Mobile Close Button */}
            {isMobileOpen && onCloseMobile ? (
              <button
                type="button"
                onClick={onCloseMobile}
                className="w-8 h-8 rounded-xl flex md:hidden items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 punch-tap transition-all shrink-0 cursor-pointer"
                title="Close Sidebar"
              >
                <X className="w-4.5 h-4.5 text-zinc-700 dark:text-zinc-300" />
              </button>
            ) : onToggleCollapse ? (
              /* Desktop Collapse Toggle Button */
              <button
                type="button"
                id="btn-toggle-sidebar"
                onClick={onToggleCollapse}
                className="w-8 h-8 rounded-xl hidden md:flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 punch-tap transition-all shrink-0 cursor-pointer"
                title={isCollapsed ? 'Expand Sidebar (Ctrl+\\)' : 'Collapse Sidebar to free workspace'}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="w-4.5 h-4.5 text-zinc-700 dark:text-zinc-300" />
                ) : (
                  <PanelLeftClose className="w-4.5 h-4.5 text-zinc-600 dark:text-zinc-400" />
                )}
              </button>
            ) : null}
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {/* New Chat Button */}
            <button
              id="nav-new-chat"
              onClick={() => {
                onNewChat();
                onCloseMobile?.();
              }}
              className={`w-full flex items-center ${
                isCollapsed && !isMobileOpen ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              } rounded-xl text-[14px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70 punch-tap transition-all group cursor-pointer`}
              title="Start New Chat & Timetable"
            >
              <SquarePen className="w-4.5 h-4.5 text-zinc-600 dark:text-zinc-400 shrink-0 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
              {(!isCollapsed || isMobileOpen) && <span className="truncate">New Chat</span>}
            </button>

            {/* History */}
            <button
              id="nav-history"
              onClick={() => {
                onSelectTab('history');
                onCloseMobile?.();
              }}
              className={`w-full flex items-center ${
                isCollapsed && !isMobileOpen
                  ? 'justify-center p-2.5 relative'
                  : 'justify-between px-3 py-2.5'
              } rounded-xl text-[14px] font-medium punch-tap transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-zinc-200/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
              }`}
              title="Timetable History"
            >
              <div
                className={`flex items-center ${
                  isCollapsed && !isMobileOpen ? 'justify-center' : 'gap-3'
                } shrink-0`}
              >
                <History className="w-4.5 h-4.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
                {(!isCollapsed || isMobileOpen) && <span>History</span>}
              </div>
              {timetablesCount > 0 &&
                (isCollapsed && !isMobileOpen ? (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-zinc-900" />
                ) : (
                  <span className="px-1.5 py-0.5 text-[11px] bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full font-semibold">
                    {timetablesCount}
                  </span>
                ))}
            </button>

            {/* Templates */}
            <button
              id="nav-templates"
              onClick={() => {
                onSelectTab('templates');
                onCloseMobile?.();
              }}
              className={`w-full flex items-center ${
                isCollapsed && !isMobileOpen ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              } rounded-xl text-[14px] font-medium punch-tap transition-all cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-zinc-200/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
              }`}
              title="Department Templates"
            >
              <LayoutGrid className="w-4.5 h-4.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
              {(!isCollapsed || isMobileOpen) && <span className="truncate">Templates</span>}
            </button>

            {/* AI Persistent Memory */}
            {onOpenMemoryModal && (
              <button
                id="nav-ai-memory"
                type="button"
                onClick={() => {
                  onOpenMemoryModal();
                  onCloseMobile?.();
                }}
                className={`w-full flex items-center ${
                  isCollapsed && !isMobileOpen
                    ? 'justify-center p-2.5'
                    : 'justify-start gap-3 px-3 py-2.5'
                } rounded-xl text-[14px] font-medium punch-tap transition-all text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 cursor-pointer group`}
                title="AI Long-Term Memory & Rules"
              >
                <Brain className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-110 transition-transform" />
                {(!isCollapsed || isMobileOpen) && <span>AI Memory</span>}
              </button>
            )}

            {/* Quick Dark Mode Toggle in Sidebar */}
            {onToggleDarkMode && (
              <button
                id="sidebar-dark-mode-toggle"
                type="button"
                onClick={onToggleDarkMode}
                className={`w-full flex items-center ${
                  isCollapsed && !isMobileOpen ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                } rounded-xl text-[14px] font-medium punch-tap transition-all text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 cursor-pointer group`}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                <div
                  className={`flex items-center ${
                    isCollapsed && !isMobileOpen ? 'justify-center' : 'gap-3'
                  } shrink-0`}
                >
                  {isDarkMode ? (
                    <Moon className="w-4.5 h-4.5 text-indigo-400 shrink-0 group-hover:text-indigo-300" />
                  ) : (
                    <Sun className="w-4.5 h-4.5 text-amber-500 shrink-0 group-hover:text-amber-600" />
                  )}
                  {(!isCollapsed || isMobileOpen) && (
                    <span className="truncate">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
                  )}
                </div>

                {(!isCollapsed || isMobileOpen) && (
                  <div
                    className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center px-0.5 ${
                      isDarkMode ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                        isDarkMode ? 'translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                )}
              </button>
            )}
          </nav>
        </div>

        {/* Bottom User Profile / Cloud Sync Area */}
        {onOpenAuthModal && (
          <div className={`border-t border-zinc-200/70 dark:border-zinc-800/80 ${isCollapsed && !isMobileOpen ? 'p-2' : 'p-3'}`}>
            {currentUser && !currentUser.isAnonymous ? (
              <button
                type="button"
                id="btn-user-account"
                onClick={() => {
                  onOpenAuthModal();
                  onCloseMobile?.();
                }}
                className={`w-full flex items-center ${
                  isCollapsed && !isMobileOpen ? 'justify-center p-2' : 'gap-2.5 p-2'
                } rounded-2xl bg-zinc-100/90 dark:bg-zinc-800/90 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 transition-all punch-tap cursor-pointer text-left group`}
                title={`${currentUser.displayName || currentUser.email} - Cloud Connected`}
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-7.5 h-7.5 rounded-xl object-cover border border-indigo-300 dark:border-indigo-700 shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-7.5 h-7.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                    {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}

                {(!isCollapsed || isMobileOpen) && (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate">
                        {currentUser.displayName || 'My Account'}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    </div>
                    <div className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>Cloud Synced</span>
                    </div>
                  </div>
                )}
              </button>
            ) : (
              <button
                type="button"
                id="btn-sign-in"
                onClick={() => {
                  onOpenAuthModal();
                  onCloseMobile?.();
                }}
                className={`w-full flex items-center ${
                  isCollapsed && !isMobileOpen ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                } rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/20 transition-all punch-tap cursor-pointer`}
                title="Sign in with Google / Email to save memory & chats permanently"
              >
                <div className={`flex items-center ${isCollapsed && !isMobileOpen ? 'justify-center' : 'gap-2.5'}`}>
                  <LogIn className="w-4 h-4 shrink-0" />
                  {(!isCollapsed || isMobileOpen) && (
                    <span className="text-[13px] font-semibold">Sign in / Save</span>
                  )}
                </div>
                {(!isCollapsed || isMobileOpen) && (
                  <span className="text-[9.5px] bg-white/20 px-1.5 py-0.5 rounded-md font-medium">
                    Google
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
};

