'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { LandingHero } from '@/components/LandingHero';
import { Sidebar } from '@/components/Sidebar';
import { MainCanvas } from '@/components/MainCanvas';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Show dark loading screen while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
        <span className="text-sm font-medium text-zinc-500">Initializing Flare...</span>
      </div>
    );
  }

  // Unauthenticated visitors see the Landing Page Hero
  if (!isSignedIn) {
    return <LandingHero />;
  }

  // Authenticated users see the Main Application Shell
  return (
    <div className="flex h-screen w-full bg-zinc-950 overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((prev) => !prev)}
      />
      <MainCanvas
        isSidebarOpen={isSidebarOpen}
        onOpenSidebar={() => setIsSidebarOpen(true)}
      />
    </div>
  );
}
