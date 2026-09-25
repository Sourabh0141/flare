'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/ui/wordmark';

/**
 * Route-level recovery screen. A crash in a page leaves this instead of a blank window,
 * with a way back that does not lose the session.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Flare page failed:', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-6 px-6 sm:px-12">
      <Wordmark />
      <h1 className="type-display max-w-2xl text-4xl text-linen sm:text-6xl">
        Something went wrong on this page.
      </h1>
      <p className="max-w-md text-linen-dim">
        The rest of Flare is fine. Try the page again, or go back to the start. If it keeps
        happening, the error reference is{' '}
        <code className="rounded-sm bg-soot px-1.5 py-0.5 text-sm text-ember-soft">
          {error.digest ?? error.name}
        </code>
        .
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/"
          className="type-ui inline-flex h-10 items-center rounded-md border border-ash px-4 text-[15px] text-linen hover:bg-soot-raised"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
