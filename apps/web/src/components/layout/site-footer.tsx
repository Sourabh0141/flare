import Link from 'next/link';
import { Wordmark } from '../ui/wordmark';

export function SiteFooter() {
  return (
    <footer className="border-t border-ash/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-col gap-2">
          <Wordmark />
          <p className="max-w-sm text-sm text-smoke">
            An invite-only voice companion. Audio is processed live and never stored; transcripts
            stay in your account until you delete them.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-linen-dim">
          <Link href="/about/" className="hover:text-linen">
            How it works
          </Link>
          <Link href="/sign-in/" className="hover:text-linen">
            Sign in
          </Link>
          <a
            href="https://github.com/"
            className="hover:text-linen"
            rel="noreferrer"
            target="_blank"
          >
            Source
          </a>
        </nav>
      </div>
    </footer>
  );
}
