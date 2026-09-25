import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The short terms for using Flare.',
};

const updated = 'September 25, 2026';

export default function TermsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 lg:py-20">
          <h1 className="type-display text-4xl text-linen sm:text-5xl">Terms</h1>
          <p className="mt-3 text-sm text-smoke">Last updated {updated}</p>
          <p className="mt-6 text-lg leading-relaxed text-linen-dim">
            Flare is offered as it is, for free, to people who have been invited. Using it means you
            agree to the following.
          </p>

          <Section title="It is a companion, not a source of truth">
            <p>
              Flare is a language model with a face. It can be wrong, confidently, about facts,
              dates, medicine, money and law. Treat what it says as conversation, not advice.
            </p>
          </Section>

          <Section title="Fair use">
            <p>
              Do not use Flare to harass, impersonate, or produce material that is illegal or that
              targets a real person. Do not attempt to extract other people&apos;s data, overload
              the service, or work around the daily limits. Invitations are personal; sharing an
              account is not allowed.
            </p>
          </Section>

          <Section title="Availability">
            <p>
              Flare runs on free service tiers and a small budget. It may be slow, rate limited, or
              unavailable without notice, and it may be changed or shut down. Conversations may be
              deleted if the project ends; export anything you want to keep.
            </p>
          </Section>

          <Section title="Your content">
            <p>
              What you say stays yours. Flare stores it only to keep the conversation going and uses
              it for nothing else, as described in the{' '}
              <Link href="/privacy/" className="text-ember-soft underline-offset-4 hover:underline">
                privacy page
              </Link>
              . You can delete it at any time.
            </p>
          </Section>

          <Section title="No warranty">
            <p>
              The service is provided without warranty of any kind. To the extent the law allows,
              the people who run Flare are not liable for any loss arising from its use.
            </p>
          </Section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="type-heading text-2xl text-linen">{title}</h2>
      <div className="mt-3 max-w-2xl leading-relaxed text-linen-dim">{children}</div>
    </section>
  );
}
