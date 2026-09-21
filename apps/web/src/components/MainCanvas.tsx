'use client';

import React, { useState, useRef } from 'react';
import { Menu, Sparkles, Mic, Volume2, Loader2, Brain } from 'lucide-react';
import { useConversations } from '@/context/ConversationContext';
import { AvatarCanvas } from './AvatarCanvas';
import { CharacterState } from './Avatar';

interface MainCanvasProps {
  onOpenSidebar: () => void;
  isSidebarOpen: boolean;
}

export function MainCanvas({ onOpenSidebar, isSidebarOpen }: MainCanvasProps) {
  const { conversations, activeConversationId } = useConversations();
  const [characterState, setCharacterState] = useState<CharacterState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  // Status configuration for visual feedback (R10)
  const statusConfig = {
    idle: {
      label: 'Ready',
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: Sparkles,
    },
    listening: {
      label: 'Listening...',
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse',
      icon: Mic,
    },
    processing: {
      label: 'Thinking...',
      color: 'bg-purple-500/20 text-purple-300 border-purple-500/30 animate-pulse',
      icon: Brain,
    },
    speaking: {
      label: 'Speaking',
      color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      icon: Volume2,
    },
  };

  const currentStatus = statusConfig[characterState];
  const StatusIcon = currentStatus.icon;

  return (
    <main className="relative flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden select-none">
      {/* Hidden Audio Element for Web Audio API Analysis */}
      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />

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

      {/* Center 3D Character Canvas Stage (R9, R36) */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center">
        {/* Atmospheric Ambient Glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

        {/* 3D Avatar WebGL Canvas */}
        <AvatarCanvas
          state={characterState}
          audioElement={audioRef.current}
          className="w-full h-full z-10"
        />
      </div>

      {/* Bottom Floating Control Bar (Preview & Preparation for Unit 9 PTT) */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-end p-6 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent pointer-events-none">
        <div className="flex flex-col items-center gap-4 pointer-events-auto">
          {/* State Preview Switches for Testing Animation Transitions (R37) */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-md text-xs">
            {(['idle', 'listening', 'processing', 'speaking'] as CharacterState[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setCharacterState(st)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-all ${
                  characterState === st
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Primary PTT Button Anchor (To be fully wired in Unit 9) */}
          <div className="relative group">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
                characterState === 'listening'
                  ? 'bg-amber-500 text-zinc-950 shadow-amber-500/40 scale-105 ring-4 ring-amber-400/30'
                  : characterState === 'processing'
                  ? 'bg-purple-800 text-purple-300 cursor-not-allowed shadow-purple-900/30'
                  : characterState === 'speaking'
                  ? 'bg-indigo-600 text-white shadow-indigo-600/40 animate-pulse'
                  : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-purple-600/30 hover:scale-105 active:scale-95'
              }`}
            >
              {characterState === 'processing' ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : characterState === 'speaking' ? (
                <Volume2 className="w-7 h-7" />
              ) : (
                <Mic className="w-7 h-7" />
              )}
            </div>
          </div>

          <p className="text-xs text-zinc-500 font-medium">
            {characterState === 'processing'
              ? 'AI is generating response...'
              : characterState === 'speaking'
              ? 'Avatar speaking with ARKit lip-sync'
              : 'Hold to speak with Flare'}
          </p>
        </div>
      </footer>
    </main>
  );
}
