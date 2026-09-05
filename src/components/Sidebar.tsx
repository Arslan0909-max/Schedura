import React from 'react';
import {
  SquarePen,
  History,
  LayoutGrid,
  Settings,
  Calendar,
  PanelLeftClose,
  PanelLeftOpen,
  Brain,
  X,
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'chat' | 'history' | 'templates' | 'settings' | 'memories';
  onSelectTab: (tab: 'chat' | 'history' | 'templates' | 'settings' | 'memories') => void;
  onNewChat: () => void;
  timetablesCount: number;
  memoriesCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
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
}) => {
  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        />
      )}

      <aside
        id="schedura-sidebar"
        style={{ width: isCollapsed ? 64 : `${width}px` }}
        className={`liquid-glass-subtle border-r border-zinc-200/70 flex flex-col justify-between select-none shrink-0 transition-all duration-200 overflow-hidden relative ${
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
                <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-white shadow-sm shadow-black/20 shrink-0 punch-tap">
                  <Calendar className="w-4.5 h-4.5" />
                </div>
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="font-semibold text-[17px] tracking-tight text-zinc-900 truncate">
                    Schedura
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-200/70 text-zinc-800 rounded-md border border-zinc-200/80 shrink-0">
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
                className="w-8 h-8 rounded-xl flex md:hidden items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/70 punch-tap transition-all shrink-0"
                title="Close Sidebar"
              >
                <X className="w-4.5 h-4.5 text-zinc-700" />
              </button>
            ) : onToggleCollapse ? (
              /* Desktop Collapse Toggle Button */
              <button
                type="button"
                id="btn-toggle-sidebar"
                onClick={onToggleCollapse}
                className="w-8 h-8 rounded-xl hidden md:flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/70 punch-tap transition-all shrink-0"
                title={isCollapsed ? 'Expand Sidebar (Ctrl+\\)' : 'Collapse Sidebar to free workspace'}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="w-4.5 h-4.5 text-zinc-700" />
                ) : (
                  <PanelLeftClose className="w-4.5 h-4.5" />
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
              } rounded-xl text-[14px] font-medium text-zinc-700 hover:bg-zinc-200/70 punch-tap transition-all group`}
              title="Start New Chat & Timetable"
            >
              <SquarePen className="w-4.5 h-4.5 text-zinc-600 shrink-0 group-hover:text-zinc-900" />
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
              } rounded-xl text-[14px] font-medium punch-tap transition-all ${
                activeTab === 'history'
                  ? 'bg-zinc-200/90 text-zinc-900 font-semibold shadow-xs'
                  : 'text-zinc-700 hover:bg-zinc-200/60'
              }`}
              title="Timetable History"
            >
              <div
                className={`flex items-center ${
                  isCollapsed && !isMobileOpen ? 'justify-center' : 'gap-3'
                } shrink-0`}
              >
                <History className="w-4.5 h-4.5 text-zinc-600 shrink-0" />
                {(!isCollapsed || isMobileOpen) && <span>History</span>}
              </div>
              {timetablesCount > 0 &&
                (isCollapsed && !isMobileOpen ? (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white" />
                ) : (
                  <span className="px-1.5 py-0.5 text-[11px] bg-zinc-200 text-zinc-700 rounded-full font-semibold">
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
              } rounded-xl text-[14px] font-medium punch-tap transition-all ${
                activeTab === 'templates'
                  ? 'bg-zinc-200/90 text-zinc-900 font-semibold shadow-xs'
                  : 'text-zinc-700 hover:bg-zinc-200/60'
              }`}
              title="Department Templates"
            >
              <LayoutGrid className="w-4.5 h-4.5 text-zinc-600 shrink-0" />
              {(!isCollapsed || isMobileOpen) && <span className="truncate">Templates</span>}
            </button>

            {/* AI Bot Memories */}
            <button
              id="nav-memories"
              onClick={() => {
                onSelectTab('memories');
                onCloseMobile?.();
              }}
              className={`w-full flex items-center ${
                isCollapsed && !isMobileOpen
                  ? 'justify-center p-2.5 relative'
                  : 'justify-between px-3 py-2.5'
              } rounded-xl text-[14px] font-medium punch-tap transition-all ${
                activeTab === 'memories'
                  ? 'bg-indigo-100 text-indigo-950 font-semibold shadow-xs'
                  : 'text-zinc-700 hover:bg-zinc-200/60'
              }`}
              title="Schedura AI Memories & Project Context"
            >
              <div
                className={`flex items-center ${
                  isCollapsed && !isMobileOpen ? 'justify-center' : 'gap-3'
                } shrink-0`}
              >
                <Brain className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                {(!isCollapsed || isMobileOpen) && <span>AI Memories</span>}
              </div>
              {typeof memoriesCount === 'number' &&
                memoriesCount > 0 &&
                (isCollapsed && !isMobileOpen ? (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white" />
                ) : (
                  <span className="px-1.5 py-0.5 text-[10.5px] bg-indigo-200/80 text-indigo-800 rounded-full font-bold">
                    {memoriesCount}
                  </span>
                ))}
            </button>

            {/* Settings */}
            <button
              id="nav-settings"
              onClick={() => {
                onSelectTab('settings');
                onCloseMobile?.();
              }}
              className={`w-full flex items-center ${
                isCollapsed && !isMobileOpen ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              } rounded-xl text-[14px] font-medium punch-tap transition-all ${
                activeTab === 'settings'
                  ? 'bg-zinc-200/90 text-zinc-900 font-semibold shadow-xs'
                  : 'text-zinc-700 hover:bg-zinc-200/60'
              }`}
              title="Settings & Anti-Clash Rules"
            >
              <Settings className="w-4.5 h-4.5 text-zinc-600 shrink-0" />
              {(!isCollapsed || isMobileOpen) && <span className="truncate">Settings</span>}
            </button>
          </nav>
        </div>
      </aside>
    </>
  );
};
