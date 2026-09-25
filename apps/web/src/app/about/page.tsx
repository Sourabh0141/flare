import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { CharacterPlayground } from '@/components/marketing/character-playground';
import { PipelineDiagram } from '@/components/marketing/pipeline-diagram';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How Flare turns a held button into a spoken reply: the browser, the edge Worker, the models, and the character system.',
};

const stack = [
  [
    'Web app',
    'Next.js, statically exported to Cloudflare Pages. React Three Fiber renders the character.',
  ],
  [
    'API',
    'A Hono application on Cloudflare Workers, kept inside the free plan CPU budget by design.',
  ],
  [
    'Database',
    'Cloudflare D1 (SQLite) for users, conversations and transcripts, with rolling summaries.',
  ],
  ['Sign-in', 'Clerk, with session tokens verified locally on the Worker using its public key.'],
  ['Hearing', 'Whisper large-v3-turbo, hosted by DeepInfra.'],
  [
    'Thinking',
    'Llama 3.1 8B Instruct in JSON mode, so mood, gesture and title come back with the reply.',
  ],
  [
    'Speaking',
    'Kokoro-82M, one sentence at a time as the reply streams, so the first words arrive while the rest is still being written.',
  ],
  [
    'Listening',
    'Silero VAD, a small neural voice detector running on your device through ONNX Runtime Web, with an energy gate as fallback.',
  ],
  ['Character', 'A Ready Player Me rig with ARKit blend shapes and a small library of body clips.'],
] as const;

export default function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
          <header className="max-w-3xl">
            <h1 className="type-display text-4xl text-linen sm:text-6xl">
              How a held button becomes a spoken reply
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-linen-dim">
              Flare runs on free tiers on purpose. That constraint shaped nearly every decision
              below, from splitting a turn into three requests to keeping the character&apos;s
              behaviour out of the language model.
            </p>
          </header>

          <section aria-labelledby="pipeline-heading" className="mt-16">
            <h2 id="pipeline-heading" className="type-heading text-2xl text-linen sm:text-3xl">
              The path of one turn
            </h2>
            <div className="mt-6 overflow-x-auto rounded-lg border border-ash/70 bg-soot/50 p-4 sm:p-6">
              <PipelineDiagram />
            </div>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              <Explainer title="The browser does the cheap work">
                Recording, silence detection, lip-sync, blinking, gaze and gestures all run on your
                device. The Worker never decodes audio or parses uploads; it forwards a raw body and
                streams the reply back.
              </Explainer>
              <Explainer title="The reply streams, sentence by sentence">
                The model&apos;s words arrive as a stream. The Worker splits them at sentence
                boundaries and asks for audio of each sentence the moment it is complete, so the
                first words are spoken while the rest is still being written. Every stage can be
                cancelled without wasting the others.
              </Explainer>
              <Explainer title="One model call per turn">
                The reply begins with a one-line tag carrying the mood, a gesture, how strongly it
                is felt and, on a new thread, a title; the spoken text follows. Prompts are short,
                replies come back in your language, and the history is condensed into a summary once
                a conversation passes twenty messages.
              </Explainer>
            </div>
          </section>

          <section aria-labelledby="character-heading" className="mt-20 max-w-3xl">
            <h2 id="character-heading" className="type-heading text-2xl text-linen sm:text-3xl">
              A character that does not need a prompt to breathe
            </h2>
            <div className="mt-6 flex flex-col gap-4 leading-relaxed text-linen-dim">
              <p>
                The model chooses from ten moods and five gestures, and that is the whole of its
                influence over the body. Everything else is a state machine: idle sway and breathing
                on a clock, blinks on a random timer, eyes that saccade around a target, a head that
                leans in while listening and drifts up while thinking.
              </p>
              <p>
                Each mood is a hand-tuned set of blend-shape weights on brows, eyes and cheeks,
                chosen so it can be held while the mouth is busy with lip-sync. Strong moods briefly
                blend in a body clip at reduced weight, so annoyance reads as a flicker rather than
                a tantrum. The stage lights follow the same state, in the scene and on the page.
              </p>
            </div>
          </section>

          <section aria-labelledby="playground-heading" className="mt-20">
            <h2 id="playground-heading" className="type-heading text-2xl text-linen sm:text-3xl">
              Try the character
            </h2>
            <p className="mt-3 max-w-2xl text-linen-dim">
              These buttons write to the same state the assistant uses. Pick a mood, add a gesture,
              switch the state, and watch the face, posture and light respond.
            </p>
            <div className="mt-6">
              <CharacterPlayground />
            </div>
          </section>

          <section aria-labelledby="stack-heading" className="mt-20">
            <h2 id="stack-heading" className="type-heading text-2xl text-linen sm:text-3xl">
              What it is built on
            </h2>
            <dl className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
              {stack.map(([term, detail]) => (
                <div
                  key={term}
                  className="grid grid-cols-[6.5rem_1fr] gap-4 border-t border-ash/60 pt-4"
                >
                  <dt className="type-ui text-[15px] font-medium text-linen">{term}</dt>
                  <dd className="text-[15px] leading-relaxed text-linen-dim">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

function Explainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="type-heading text-lg text-linen">{title}</h3>
      <p className="leading-relaxed text-linen-dim">{children}</p>
    </div>
  );
}
