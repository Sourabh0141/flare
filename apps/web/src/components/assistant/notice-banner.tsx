'use client';

import { AlertCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAssistantStore } from '@/stores/assistant-store';
import { IconButton } from '../ui/icon-button';

/** One line of feedback at a time. Info notices clear themselves; errors stay until dismissed. */
export function NoticeBanner({ className }: { className?: string }) {
  const notice = useAssistantStore((s) => s.notice);
  const notify = useAssistantStore((s) => s.notify);

  useEffect(() => {
    if (notice?.tone !== 'info') return;
    const timer = setTimeout(() => notify(null), 5000);
    return () => clearTimeout(timer);
  }, [notice, notify]);

  if (!notice) return null;
  const isError = notice.tone === 'error';
  const Icon = isError ? AlertCircle : Info;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={cn(
        'animate-rise-in flex max-w-md items-center gap-3 rounded-md border px-4 py-2.5 text-sm shadow-lift backdrop-blur-md',
        isError ? 'border-rust/40 bg-rust/10 text-linen' : 'border-ash bg-soot/90 text-linen-dim',
        className
      )}
    >
      <Icon
        className={cn('size-4 shrink-0', isError ? 'text-rust' : 'text-ember')}
        aria-hidden="true"
      />
      <p className="flex-1">{notice.message}</p>
      <IconButton label="Dismiss" size="sm" onClick={() => notify(null)} className="-mr-2">
        <X className="size-4" />
      </IconButton>
    </div>
  );
}
