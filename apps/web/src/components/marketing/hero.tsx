'use client';

import { SignedIn, SignedOut } from '@clerk/clerk-react';
import Link from 'next/link';
import { AvatarCanvas } from '../avatar/avatar-canvas';
import { AvatarPlaceholder } from '../avatar/avatar-placeholder';

/**
 * The hero is the character. It idles, breathes, blinks and follows the pointer with its
 * eyes, which says more about the product than any headline could.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 pt-14 pb-16 sm:px-8 lg:grid-cols-12 lg:gap-6 lg:pt-20 lg:pb-24">
        <div className="flex flex-col gap-7 lg:col-span-6">
          <h1 className="type-display text-[2.75rem] text-linen sm:text-6xl lg:text-[4.25rem]">
            Hold the button. Say anything. Flare looks up and answers.
          </h1>
          <p className="max-w-[34rem] text-lg leading-relaxed text-linen-dim">
            Flare is a voice companion with a face. There is no chat box to type into: you talk, and
            a 3D character listens, thinks, and talks back with a voice, an expression, and
            sometimes a laugh.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SignedOut>
              <Link
                href="/sign-in/"
                className="type-ui inline-flex h-12 items-center rounded-md bg-ember px-6 text-base font-medium text-ink transition-colors hover:bg-ember-soft"
              >
                Sign in to talk
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/app/"
                className="type-ui inline-flex h-12 items-center rounded-md bg-ember px-6 text-base font-medium text-ink transition-colors hover:bg-ember-soft"
              >
                Open Flare
              </Link>
            </SignedIn>
            <Link
              href="/about/"
              className="type-ui inline-flex h-12 items-center rounded-md px-4 text-base text-linen-dim transition-colors hover:text-linen"
            >
              See how it works
            </Link>
          </div>
          <p className="text-sm text-smoke">
            Invite-only while it grows. Works in any modern desktop or mobile browser with a
            microphone.
          </p>
        </div>

        <div className="relative lg:col-span-6">
          <div
            aria-hidden="true"
            className="absolute inset-x-8 top-8 h-3/4 rounded-full bg-ember/15 blur-3xl"
          />
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md lg:max-w-none">
            <AvatarCanvas
              followPointer
              framing="portrait"
              fallback={<AvatarPlaceholder />}
              className="[mask-image:linear-gradient(to_bottom,black_78%,transparent)]"
            />
          </div>
          <p className="mt-2 text-center text-xs text-smoke lg:text-right">
            Move your pointer. The eyes follow.
          </p>
        </div>
      </div>
    </section>
  );
}
