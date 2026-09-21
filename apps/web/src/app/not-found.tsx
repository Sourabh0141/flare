import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 shadow-lg shadow-purple-950/40">
        <Sparkles className="w-6 h-6" />
      </div>
      <h2 className="text-3xl font-bold text-white mb-2">404 — Page Not Found</h2>
      <p className="text-zinc-400 text-sm max-w-sm mb-6">
        The page you are looking for does not exist in the Flare application.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors shadow-lg shadow-purple-900/30"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Flare</span>
      </Link>
    </div>
  );
}
