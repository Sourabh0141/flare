/**
 * The three stages of a turn. This is a real sequence, so the steps are numbered.
 */
const steps = [
  {
    number: '1',
    title: 'Heard',
    body: 'Your browser records while you hold the button and checks for silence before anything is sent. The clip goes to Whisper and comes back as text within a second or two.',
  },
  {
    number: '2',
    title: 'Thought',
    body: 'A small language model reads the recent conversation and replies in a couple of spoken sentences. In the same breath it picks a mood and, if it fits, a gesture.',
  },
  {
    number: '3',
    title: 'Said',
    body: 'The reply is voiced by a lightweight speech model and streamed straight to you. The mouth is synced in your browser from the audio itself, so nothing waits on a server.',
  },
] as const;

export function TurnSequence() {
  return (
    <section aria-labelledby="turn-heading" className="border-t border-ash/60">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-4">
          <h2 id="turn-heading" className="type-heading text-3xl text-linen sm:text-4xl">
            One turn, three moves.
          </h2>
          <p className="mt-4 max-w-sm text-linen-dim">
            Each move is its own short request, so you see the transcript while Flare is still
            thinking, and you can cut in at any point.
          </p>
        </div>
        <ol className="flex flex-col divide-y divide-ash/60 lg:col-span-8">
          {steps.map((step) => (
            <li
              key={step.number}
              className="grid grid-cols-[3rem_1fr] gap-4 py-6 first:pt-0 last:pb-0"
            >
              <span className="type-display text-4xl text-ember" aria-hidden="true">
                {step.number}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="type-heading text-xl text-linen">{step.title}</h3>
                <p className="max-w-[38rem] leading-relaxed text-linen-dim">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
