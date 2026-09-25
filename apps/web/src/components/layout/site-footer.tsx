import Link from 'next/link';
import { config } from '@/lib/config';
import { Wordmark } from '../ui/wordmark';

const links = [
  { href: '/about/', label: 'How it works' },
  { href: '/help/', label: 'Help' },
  { href: '/changelog/', label: "What's new" },
  { href: '/invite/', label: 'Request an invite' },
  { href: '/privacy/', label: 'Privacy' },
  { href: '/terms/', label: 'Terms' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ash/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div className="flex flex-col gap-2">
          <Wordmark />
          <p className="max-w-sm text-sm text-smoke">
            An invite-only voice companion. Audio is processed live and never stored; transcripts
            stay in your account until you delete them.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-linen-dim sm:grid-cols-3"
        >
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-linen">
              {link.label}
            </Link>
          ))}
          {config.repoUrl ? (
            <a href={config.repoUrl} className="hover:text-linen" rel="noreferrer" target="_blank">
              Source code
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
