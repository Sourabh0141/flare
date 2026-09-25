'use client';

import { SignedIn, SignedOut } from '@clerk/clerk-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Wordmark } from '../ui/wordmark';

const links = [{ href: '/about/', label: 'How it works' }];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-ash/60 bg-ink/80 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8"
      >
        <Link href="/" className="rounded-md" aria-label="Flare home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              className={cn(
                'type-ui rounded-md px-3 py-2 text-[15px] transition-colors',
                pathname === link.href ? 'text-linen' : 'text-linen-dim hover:text-linen'
              )}
            >
              {link.label}
            </Link>
          ))}
          <SignedOut>
            <Link
              href="/sign-in/"
              className="type-ui rounded-md px-3 py-2 text-[15px] text-linen-dim transition-colors hover:text-linen"
            >
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/app/"
              className="type-ui ml-1 inline-flex h-9 items-center rounded-md bg-ember px-4 text-[15px] font-medium text-ink transition-colors hover:bg-ember-soft"
            >
              Open Flare
            </Link>
          </SignedIn>
        </div>
      </nav>
    </header>
  );
}
