'use client';

import React, { useEffect, useCallback } from 'react';
import { Mic, Square, Loader2, Volume2 } from 'lucide-react';
import { CharacterState } from './Avatar';

interface PushToTalkButtonProps {
  state: CharacterState;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onInterrupt: () => void;
  disabled?: boolean;
}

export function PushToTalkButton({
  state,
  onStartRecording,
  onStopRecording,
  onInterrupt,
  disabled = false,
}: PushToTalkButtonProps) {
  const isListening = state === 'listening';
  const isProcessing = state === 'processing';
  const isSpeaking = state === 'speaking';
  const isIdle = state === 'idle';

  // Pointer event handlers with pointer capture for touch/mouse stability
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled || isProcessing) return;

    if (isSpeaking) {
      onInterrupt(); // Immediate interrupt on tap while speaking (R25 / AE2)
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if unsupported
    }

    onStartRecording();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled || isProcessing || isSpeaking) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignored
    }

    if (isListening) {
      onStopRecording();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignored
    }

    if (isListening) {
      onStopRecording();
    }
  };

  // Keyboard shortcut support (Hold Space to speak, Esc to interrupt)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return; // Don't trigger when typing in input/rename fields
      }

      if (e.code === 'Space' && !e.repeat) {
        if (isSpeaking) {
          e.preventDefault();
          onInterrupt();
        } else if (isIdle && !disabled && !isProcessing) {
          e.preventDefault();
          onStartRecording();
        }
      } else if (e.code === 'Escape' && isSpeaking) {
        e.preventDefault();
        onInterrupt();
      }
    },
    [isSpeaking, isIdle, disabled, isProcessing, onStartRecording, onInterrupt]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        if (isListening) {
          e.preventDefault();
          onStopRecording();
        }
      }
    },
    [isListening, onStopRecording]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* Outer Button Glow & Ring Container */}
      <div className="relative flex items-center justify-center">
        {/* Pulsing Acoustic Rings when recording */}
        {isListening && (
          <>
            <div className="absolute w-24 h-24 rounded-full bg-amber-500/20 animate-ping pointer-events-none" />
            <div className="absolute w-28 h-28 rounded-full border border-amber-500/30 animate-pulse pointer-events-none" />
          </>
        )}

        {/* Pulsing Rings when speaking */}
        {isSpeaking && (
          <>
            <div className="absolute w-24 h-24 rounded-full bg-indigo-500/20 animate-pulse pointer-events-none" />
            <div className="absolute w-28 h-28 rounded-full border border-indigo-500/30 pointer-events-none" />
          </>
        )}

        {/* Processing Spinner Ring */}
        {isProcessing && (
          <div className="absolute w-20 h-20 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin pointer-events-none" />
        )}

        {/* Primary Interactive Push-to-Talk / Interrupt Button */}
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          disabled={disabled || isProcessing}
          aria-label={
            isSpeaking
              ? 'Interrupt AI speech'
              : isListening
              ? 'Recording speech. Release to send.'
              : isProcessing
              ? 'AI is processing response'
              : 'Hold to speak'
          }
          className={`relative z-10 w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 transform touch-none shadow-2xl ${
            isListening
              ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-zinc-950 scale-110 shadow-amber-500/50 ring-4 ring-amber-400/40'
              : isProcessing
              ? 'bg-zinc-900 border border-purple-500/40 text-purple-400 cursor-not-allowed shadow-purple-950/40 scale-95 opacity-80'
              : isSpeaking
              ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-indigo-600/50 hover:from-rose-600 hover:to-red-600 group cursor-pointer active:scale-95'
              : 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-500 text-white shadow-purple-600/40 hover:scale-105 active:scale-95 hover:shadow-purple-500/60'
          }`}
        >
          {isProcessing ? (
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          ) : isSpeaking ? (
            <>
              {/* Normal speaking icon */}
              <Volume2 className="w-8 h-8 group-hover:hidden transition-all" />
              {/* Hover stop icon */}
              <Square className="w-7 h-7 hidden group-hover:block fill-current transition-all" />
            </>
          ) : isListening ? (
            <Mic className="w-8 h-8 animate-pulse text-zinc-950" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>
      </div>

      {/* Instructional Caption */}
      <div className="flex flex-col items-center text-center">
        <span className="text-xs font-semibold tracking-wide text-zinc-300">
          {isListening
            ? 'Release to send message'
            : isProcessing
            ? 'Flare is thinking...'
            : isSpeaking
            ? 'Tap button or press Space to stop'
            : 'Hold button or Space to speak'}
        </span>
        <span className="text-[10px] text-zinc-500 mt-0.5">
          {isListening
            ? 'Microphone active • Capturing voice'
            : isSpeaking
            ? 'Audio playing • ARKit lip-sync active'
            : 'Pure voice conversation'}
        </span>
      </div>
    </div>
  );
}
