import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { InviteForm } from '@/components/marketing/invite-form';

export const metadata: Metadata = {
  title: 'Request an invite',
  description: 'Flare is invite-only while it grows. Ask for an invitation.',
};

export default function InvitePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-5">
            <h1 className="type-display text-4xl text-linen sm:text-5xl">Ask for an invitation</h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-linen-dim">
              Flare runs on free tiers and a small budget for the voice models, so it lets people in
              a few at a time. Tell us where to send the invitation and, if you like, what you would
              talk about.
            </p>
            <p className="mt-4 max-w-md text-sm text-smoke">
              Already invited? Use the link in your email, or sign in with that address.
            </p>
          </div>
          <div className="relative lg:col-span-7">
            <InviteForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
