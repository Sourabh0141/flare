import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { CHANGELOG } from '@/lib/changelog';

export const metadata: Metadata = {
  title: "What's new",
  description: 'Changes to Flare, newest first.',
};

export default function ChangelogPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 lg:py-20">
          <h1 className="type-display text-4xl text-linen sm:text-5xl">What&apos;s new</h1>
          <p className="mt-4 text-lg text-linen-dim">Changes to Flare, newest first.</p>

          <ol className="mt-12 flex flex-col gap-12">
            {CHANGELOG.map((entry) => (
              <li key={entry.version} className="grid gap-4 sm:grid-cols-[8rem_1fr]">
                <div className="text-sm text-smoke">
                  <div className="type-ui font-medium text-ember">{entry.version}</div>
                  <time dateTime={entry.date}>
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </time>
                </div>
                <div>
                  <h2 className="type-heading text-2xl text-linen">{entry.title}</h2>
                  <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-linen-dim">
                    {entry.changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
