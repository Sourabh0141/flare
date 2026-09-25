'use client';

import { SignIn, SignUp } from '@clerk/clerk-react';
import Link from 'next/link';
import { Wordmark } from '../ui/wordmark';

export function AuthPanel({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-5 py-10">
      <Link href="/" className="mb-10 rounded-md" aria-label="Flare home">
        <Wordmark />
      </Link>
      <div className="w-full max-w-md">
        {mode === 'sign-in' ? (
          <SignIn routing="hash" forceRedirectUrl="/app/" signUpUrl="/sign-up/" />
        ) : (
          <SignUp routing="hash" forceRedirectUrl="/app/" signInUrl="/sign-in/" />
        )}
      </div>
      <p className="mt-8 max-w-sm text-center text-sm text-smoke">
        {mode === 'sign-in'
          ? 'Flare is invite-only. If you were invited, use the email the invitation was sent to.'
          : 'Sign-up needs an invitation. Follow the link in your invitation email to continue.'}
      </p>
    </main>
  );
}
