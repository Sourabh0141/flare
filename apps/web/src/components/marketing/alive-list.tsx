const behaviours = [
  {
    title: 'It looks at you',
    body: 'The eyes track your pointer on this page and settle on you while you speak, with small glances so the gaze never freezes.',
  },
  {
    title: 'It breathes and blinks',
    body: 'Idle motion, breathing and irregular blinks run on a clock in your browser. Nothing about presence needs a model call.',
  },
  {
    title: 'The face carries the mood',
    body: 'Every reply comes with one of ten moods. Brows, eyes and mouth corners shift to match, and hold while the lips are busy talking.',
  },
  {
    title: 'The body joins in',
    body: 'A laugh, a shake of the head, an occasional dance if you ask for one. Gestures are picked with the reply and played from a small clip library.',
  },
  {
    title: 'It waits for you to finish',
    body: 'In hands-free mode a voice-activity gate on your device learns the room and sends a turn when you pause. The microphone rests while Flare thinks or speaks, so it never answers itself.',
  },
  {
    title: 'The light follows the conversation',
    body: 'The room warms while Flare listens, cools while it thinks, and opens up when it speaks. You can read the state without reading a label.',
  },
] as const;

export function AliveList() {
  return (
    <section aria-labelledby="alive-heading" className="border-t border-ash/60 bg-soot/40">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <h2 id="alive-heading" className="type-heading text-3xl text-linen sm:text-4xl">
            What makes it feel alive
          </h2>
          <p className="mt-4 text-linen-dim">
            Most of the character is deterministic. The language model only decides what to say, how
            it feels about it, and whether the body should react.
          </p>
        </div>
        <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {behaviours.map((item) => (
            <div key={item.title} className="flex flex-col gap-2">
              <dt className="type-heading text-lg text-linen">{item.title}</dt>
              <dd className="max-w-sm leading-relaxed text-linen-dim">{item.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
