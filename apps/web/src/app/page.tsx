import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { AliveList } from '@/components/marketing/alive-list';
import { Hero } from '@/components/marketing/hero';
import { PrivacyNotes } from '@/components/marketing/privacy-notes';
import { TurnSequence } from '@/components/marketing/turn-sequence';

export const metadata: Metadata = {
  title: 'Flare: a voice companion with a face',
};

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TurnSequence />
        <AliveList />
        <PrivacyNotes />
      </main>
      <SiteFooter />
    </div>
  );
}
