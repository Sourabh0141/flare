import Link from 'next/link';
import { Wordmark } from '@/components/ui/wordmark';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-6 px-6 sm:px-12">
      <Wordmark />
      <h1 className="type-display max-w-2xl text-4xl text-linen sm:text-6xl">
        There is nothing to hear at this address.
      </h1>
      <p className="max-w-md text-linen-dim">
        The page may have moved, or the link was mistyped. Flare is waiting on the home page.
      </p>
      <Link
        href="/"
        className="type-ui inline-flex h-11 items-center rounded-md bg-ember px-5 text-[15px] font-medium text-ink hover:bg-ember-soft"
      >
        Go home
      </Link>
    </main>
  );
}
