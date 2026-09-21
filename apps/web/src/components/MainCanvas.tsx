'use client';

import React, { useRef } from 'react';
import { Menu, Sparkles, Mic, Volume2, Brain, AlertCircle, X } from 'lucide-react';
import { useConversations } from '@/context/ConversationContext';
import { AvatarCanvas } from './AvatarCanvas';
import { PushToTalkButton } from './PushToTalkButton';
import { useConversation } from '@/hooks/useConversation';

interface MainCanvasProps {
  onOpenSidebar: () => void;
  isSidebarOpen: boolean;
}

export function MainCanvas({ onOpenSidebar, isSidebarOpen }: MainCanvasProps) {
  const { conversations, activeConversationId } = useConversations();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    state,
    errorMessage,
    startRecording,
    stopRecording,
    interrupt,
    clearError,
  } = useConversation(audioRef);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  // Status configuration for visual feedback (R10)
  const statusConfig = {
    idle: {
      label: 'Ready',
      color: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
      icon: Sparkles,
    },
    listening: {
      label: 'Listening...',
      color: 'bg-amber-950/70 text-amber-300 border-amber-500/40 animate-pulse',
      icon: Mic,
    },
    processing: {
      label: 'Thinking...',
      color: 'bg-purple-950/70 text-purple-300 border-purple-500/40 animate-pulse',
      icon: Brain,
    },
    speaking: {
      label: 'Speaking',
      color: 'bg-indigo-950/70 text-indigo-300 border-indigo-500/40',
      icon: Volume2,
    },
  };

  const currentStatus = statusConfig[state];
  const StatusIcon = currentStatus.icon;

  return (
    <main className="relative flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden select-none">
      {/* Hidden Audio Element for Web Audio API FFT Analysis (R38) */}
      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" preload="auto" />

      {/* Top Header / Context Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-zinc-950/90 via-zinc-950/50 to-transparent backdrop-blur-sm pointer-events-none">
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

        {/* Live Status Badge */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium backdrop-blur-md transition-all ${currentStatus.color}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{currentStatus.label}</span>
          </div>
        </div>
      </header>

      {/* Error Alert Banner if speech/API error occurs (R32 / AE3) */}
      {errorMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs font-medium shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={clearError}
            className="p-1 text-rose-400 hover:text-rose-100 rounded-lg transition-colors"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Center 3D Character Canvas Stage (R9, R36) */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center">
        {/* Atmospheric Ambient Glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

        {/* 3D Avatar WebGL Canvas */}
        <AvatarCanvas
          state={state}
          audioElement={audioRef.current}
          className="w-full h-full z-10"
        />
      </div>

      {/* Bottom Push-To-Talk Control Bar (R10, R21-R26) */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-end p-6 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <PushToTalkButton
            state={state}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onInterrupt={interrupt}
          />
        </div>
      </footer>
    </main>
  );
}
