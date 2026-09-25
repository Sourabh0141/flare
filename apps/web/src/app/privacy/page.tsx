import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Flare records, what it keeps, who processes it, and how to delete it.',
};

const updated = 'September 25, 2026';

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 lg:py-20">
          <h1 className="type-display text-4xl text-linen sm:text-5xl">Privacy</h1>
          <p className="mt-3 text-sm text-smoke">Last updated {updated}</p>
          <p className="mt-6 text-lg leading-relaxed text-linen-dim">
            Flare is a small, invite-only project. This page says plainly what happens to your voice
            and your words. It is written to be read, not to cover anyone.
          </p>

          <Section title="What is recorded">
            <p>
              Audio is captured only while you hold the button or, in hands-free mode, while the app
              detects that you are speaking. Hands-free listening happens on your device; no audio
              leaves it until an utterance is complete. Recordings are sent once to be transcribed
              and then discarded. Neither the audio you send nor the audio Flare speaks is stored by
              Flare.
            </p>
          </Section>

          <Section title="What is kept">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Your transcript and Flare&apos;s replies, with the mood chosen for each reply.
              </li>
              <li>Conversation titles and times.</li>
              <li>Your display name, voice and personality settings.</li>
              <li>
                Rolling summaries: long conversations are condensed into a short summary rather than
                kept word for word.
              </li>
              <li>
                If you request an invitation: the name, email and note you submit, plus a hashed
                form of your network address used only to limit abuse.
              </li>
            </ul>
          </Section>

          <Section title="Who processes it">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="font-medium text-linen">Cloudflare</strong> hosts the site, the
                API and the database.
              </li>
              <li>
                <strong className="font-medium text-linen">Clerk</strong> handles sign-in and holds
                your account email.
              </li>
              <li>
                <strong className="font-medium text-linen">DeepInfra</strong> runs the speech
                recognition, language and speech synthesis models. It receives each recording, the
                recent transcript, and each reply to be voiced. Flare uses models and settings that
                do not retain inputs.
              </li>
            </ul>
          </Section>

          <Section title="What is not done">
            <p>
              No advertising, no analytics trackers, no selling or sharing of transcripts, and no
              training of models on your conversations by Flare.
            </p>
          </Section>

          <Section title="Deleting your data">
            <p>
              Delete any single conversation from the list, or erase everything at once from{' '}
              <Link
                href="/settings/"
                className="text-ember-soft underline-offset-4 hover:underline"
              >
                Settings
              </Link>
              . Erasing removes every conversation, summary and setting immediately. Your sign-in
              account can be deleted from your account profile.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              Use the{' '}
              <Link href="/invite/" className="text-ember-soft underline-offset-4 hover:underline">
                invite form
              </Link>{' '}
              to reach the person who runs Flare; it is read by a human.
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
