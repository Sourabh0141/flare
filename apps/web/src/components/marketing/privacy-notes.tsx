import Link from 'next/link';

export function PrivacyNotes() {
  return (
    <section aria-labelledby="privacy-heading" className="border-t border-ash/60">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-5">
          <h2 id="privacy-heading" className="type-heading text-3xl text-linen sm:text-4xl">
            Your voice stays yours
          </h2>
        </div>
        <div className="flex flex-col gap-6 text-linen-dim lg:col-span-7">
          <p className="max-w-[38rem] leading-relaxed">
            Recordings are used once, to write down what you said, and then discarded. Neither the
            audio you send nor the audio Flare speaks is stored anywhere.
          </p>
          <p className="max-w-[38rem] leading-relaxed">
            Transcripts are saved so Flare can remember the thread. They belong to your account, you
            can rename or delete any conversation, and long threads are condensed into a short
            summary rather than kept word for word.
          </p>
          <p className="max-w-[38rem] leading-relaxed">
            Sign-up is by invitation. If you have one,{' '}
            <Link href="/sign-in/" className="text-ember-soft underline-offset-4 hover:underline">
              sign in
            </Link>{' '}
            and say hello.
          </p>
        </div>
      </div>
    </section>
  );
}
