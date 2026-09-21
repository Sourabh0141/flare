'use client';

import React from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { Mic, Sparkles, Volume2, ShieldCheck, ArrowRight, Zap } from 'lucide-react';

export function LandingHero() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-zinc-950 overflow-hidden">
      {/* Background Glowing Ambient Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero Header Badge */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 text-xs font-medium mb-6 shadow-inner shadow-purple-500/10 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Invite-Only AI Technical Showcase</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
          Speak with <span className="bg-gradient-to-r from-purple-400 via-violet-300 to-indigo-400 bg-clip-text text-transparent">Flare</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl text-zinc-400 max-w-2xl leading-relaxed">
          A voice-first AI companion featuring a stylized full-body 3D character with real-time ARKit lip-sync and ultra-low latency audio processing.
        </p>

        {/* 3D Visual Holographic Preview Card */}
        <div className="mt-10 relative w-full max-w-md aspect-[4/3] rounded-3xl bg-gradient-to-b from-purple-900/20 to-zinc-900/60 border border-purple-500/30 backdrop-blur-xl p-6 flex flex-col items-center justify-center shadow-2xl shadow-purple-950/50 group">
          {/* Animated Avatar Glow Ring */}
          <div className="relative w-32 h-32 rounded-full bg-gradient-to-tr from-purple-600/40 to-indigo-500/30 border border-purple-400/40 flex items-center justify-center animate-glow">
            <div className="w-24 h-24 rounded-full bg-purple-950/80 flex items-center justify-center text-purple-300">
              <Mic className="w-10 h-10 text-purple-400 animate-bounce" />
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm font-semibold text-zinc-200">Interactive 3D Character</p>
            <p className="text-xs text-zinc-500 mt-1">
              Driven by browser-side Web Audio FFT analysis & ARKit blendshapes
            </p>
          </div>
        </div>

        {/* Call to Action Button */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <SignInButton mode="modal">
            <button
              type="button"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-xl shadow-purple-900/40 hover:shadow-purple-900/60 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Sign In to Start Speaking</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </SignInButton>
        </div>

        {/* Feature Pill Highlights */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left">
          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2.5">
              <Volume2 className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-200">Real-Time ARKit Sync</h4>
            <p className="text-xs text-zinc-500 mt-1">
              67 blend shapes animated via real-time browser frequency extraction.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2.5">
              <Zap className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-200">Edge Pipeline</h4>
            <p className="text-xs text-zinc-500 mt-1">
              Cloudflare Worker + Whisper ASR + Llama 3.1 + Kokoro-82M TTS.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-200">Ephemeral Audio</h4>
            <p className="text-xs text-zinc-500 mt-1">
              Conversations stored securely in D1; audio streamed and never persisted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
