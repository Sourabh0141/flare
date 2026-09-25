import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';

export const metadata: Metadata = {
  title: 'Help',
  description:
    'Microphone access, browsers, hands-free mode, keyboard shortcuts, and what to do when something goes wrong.',
};

const shortcuts = [
  ['Space (hold)', 'Talk while held; release to send'],
  ['Escape', 'Interrupt Flare or cancel a turn'],
  ['M', 'Mute or unmute in hands-free mode'],
  ['?', 'Show the shortcuts overlay'],
] as const;

const faqs = [
  {
    q: 'Flare says microphone access is blocked.',
    a: 'Your browser denied the microphone once and remembered it. Click the lock or site icon in the address bar, allow the microphone for this site, then reload. On iPhone, also check Settings, Safari, Microphone.',
  },
  {
    q: 'Nothing plays when Flare answers.',
    a: 'Browsers only allow sound after you have interacted with the page. If a reply was silent, tap it in the transcript to hear it; audio works normally from then on. Check the device is not muted and that no other app holds the speaker.',
  },
  {
    q: 'How does hands-free mode decide when I have finished?',
    a: 'It measures the room for half a second, then listens for your voice above that level. When you pause for about three quarters of a second, the turn is sent. While Flare thinks or speaks the microphone is paused, so it can never answer itself. Tap the button or press M to mute at any time.',
  },
  {
    q: 'Can I interrupt Flare by talking over it?',
    a: 'Yes, if you turn on "Interrupt by speaking" in Settings. In hands-free mode Flare then keeps a stricter ear open while it talks and stops when you say something deliberate. It works best with headphones; with speakers it can occasionally hear itself, which is why it is off by default.',
  },
  {
    q: 'Does Flare speak other languages?',
    a: 'Speak Spanish, French, Hindi, Italian, Japanese, Portuguese or Chinese and Flare answers in that language with a native voice matching the register of the voice you chose. Other languages get an English reply.',
  },
  {
    q: 'Which browsers work?',
    a: 'Current Chrome, Edge, Firefox and Safari on desktop and mobile. Safari needs a tap on the page before it will play sound, and keeps the microphone open only while the tab is in front.',
  },
  {
    q: 'Why did a new conversation start on its own?',
    a: 'After thirty minutes of quiet, the next thing you say begins a fresh thread. Older conversations stay in the list and can be reopened, renamed, exported or deleted.',
  },
  {
    q: 'What is the daily limit?',
    a: 'Each account gets a fixed number of turns per day so that the voice models, which are paid per use, cannot run up a bill. The interface warns you when ten are left.',
  },
  {
    q: 'Can I change the voice?',
    a: 'Yes. Open Settings from the bottom of the conversation list, tap a voice to hear it, and select it. You can also pick a personality there.',
  },
  {
    q: 'How do I delete what Flare knows about me?',
    a: 'Settings, then Erase my data. Every conversation and preference is removed at once and you are signed out. Individual conversations can be deleted from the list.',
  },
] as const;

export default function HelpPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 lg:py-20">
          <h1 className="type-display text-4xl text-linen sm:text-5xl">Help</h1>
          <p className="mt-4 text-lg text-linen-dim">
            Most questions are about the microphone or sound. If yours is not here,{' '}
            <Link href="/invite/" className="text-ember-soft underline-offset-4 hover:underline">
              write to us through the invite form
            </Link>
            .
          </p>

          <section aria-labelledby="shortcuts" className="mt-12">
            <h2 id="shortcuts" className="type-heading text-2xl text-linen">
              Keyboard shortcuts
            </h2>
            <dl className="mt-4 divide-y divide-ash/60 border-y border-ash/60">
              {shortcuts.map(([key, action]) => (
                <div key={key} className="grid grid-cols-[9rem_1fr] gap-4 py-3">
                  <dt>
                    <kbd className="rounded-sm border border-ash bg-soot px-2 py-0.5 font-sans text-sm text-linen">
                      {key}
                    </kbd>
                  </dt>
                  <dd className="text-linen-dim">{action}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="faq" className="mt-12">
            <h2 id="faq" className="type-heading text-2xl text-linen">
              Questions
            </h2>
            <div className="mt-4 divide-y divide-ash/60 border-y border-ash/60">
              {faqs.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="cursor-pointer list-none text-[17px] font-medium text-linen marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="mr-2 inline-block text-ember transition-transform group-open:rotate-90">
                      ›
                    </span>
                    {item.q}
                  </summary>
                  <p className="mt-2 max-w-2xl pl-5 leading-relaxed text-linen-dim">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
