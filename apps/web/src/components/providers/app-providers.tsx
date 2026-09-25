'use client';

import { ClerkProvider } from '@clerk/clerk-react';
import type { ReactNode } from 'react';
import { config } from '@/lib/config';

const clerkAppearance = {
  variables: {
    colorPrimary: '#f0a35b',
    colorBackground: '#1f1b17',
    colorText: '#f3ebdd',
    colorTextSecondary: '#c9bfb0',
    colorInputBackground: '#15120f',
    colorInputText: '#f3ebdd',
    colorNeutral: '#f3ebdd',
    borderRadius: '10px',
    fontFamily: 'var(--font-bricolage), system-ui, sans-serif',
  },
  elements: {
    card: 'shadow-lift border border-ash',
    footer: 'hidden',
  },
} as const;

/** Wraps the app in Clerk. Renders a plain setup notice when the key is absent. */
export function AppProviders({ children }: { children: ReactNode }) {
  if (!config.clerkPublishableKey) {
    return <MissingConfiguration />;
  }
  return (
    <ClerkProvider
      publishableKey={config.clerkPublishableKey}
      appearance={clerkAppearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}

function MissingConfiguration() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="type-heading text-3xl">Flare isn&apos;t configured yet</h1>
      <p className="text-linen-dim">
        This build has no Clerk publishable key. Set{' '}
        <code className="rounded-sm bg-soot px-1.5 py-0.5 text-sm text-ember-soft">
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        </code>{' '}
        and{' '}
        <code className="rounded-sm bg-soot px-1.5 py-0.5 text-sm text-ember-soft">
          NEXT_PUBLIC_API_URL
        </code>{' '}
        in the deployment environment, then rebuild.
      </p>
    </main>
  );
}
