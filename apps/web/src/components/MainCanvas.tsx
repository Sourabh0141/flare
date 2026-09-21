'use client';

import React from 'react';
import { Menu, Mic, Sparkles } from 'lucide-react';
import { useConversations } from '@/context/ConversationContext';

interface MainCanvasProps {
  onOpenSidebar: () => void;
  isSidebarOpen: boolean;
}

export function MainCanvas({ onOpenSidebar, isSidebarOpen }: MainCanvasProps) {
  const { conversations, activeConversationId } = useConversations();

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <main className="relative flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Top Header / Mobile Toggle Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-zinc-950/80 to-transparent backdrop-blur-sm pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          {!isSidebarOpen && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 border border-zinc-800/80 rounded-xl transition-colors backdrop-blur-md"
              title="Open Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-200">
              {activeConversation ? activeConversation.title : 'New conversation'}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs font-medium backdrop-blur-md">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Flare 3D Ready</span>
          </div>
        </div>
      </header>

      {/* Center 3D Character Canvas Stage */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4">
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

        {/* 3D Character Viewport Container */}
        <div className="relative w-full max-w-lg aspect-square flex flex-col items-center justify-center">
          <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-gradient-to-tr from-purple-900/30 to-indigo-900/20 border border-purple-500/30 flex items-center justify-center shadow-2xl shadow-purple-950/40">
            <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-purple-400">
              <Mic className="w-12 h-12 text-purple-400 animate-pulse" />
            </div>
          </div>

          <div className="mt-6 text-center">
            <h3 className="text-base font-semibold text-zinc-200">Flare AI Assistant</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              3D Character stage active. Ready for Unit 8 avatar rendering and Unit 9 push-to-talk.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
